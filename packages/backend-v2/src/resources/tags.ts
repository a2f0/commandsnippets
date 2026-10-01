import {
  tagCreateAttributesSchema,
  tagListQuerySchema,
  tagUpdateAttributesSchema,
} from '@commandsnippets/api-shared';
import {and, eq, sql} from 'drizzle-orm';
import {type Context, Hono} from 'hono';
import * as z from 'zod/mini';
import {requireUser} from '../auth/permissions';
import {isUniqueViolation} from '../db/errors';
import {type Tag, tags, type User} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {uniqueTogether} from '../lib/errors';
import {parseResource} from '../lib/jsonapi';
import {OrderedModel, type OrderedSpec} from '../lib/ordered';
import {validateFields} from '../lib/validate';
import {usernameIs} from './filters';
import {
  appliesAfter,
  changedMeanwhile,
  clientUpdated,
  WRITE_ATTEMPTS,
  writtenBefore,
} from './lww';
import {nextRevision, tagResource} from './owned';
import {reorder} from './reorder';
import {TAG} from './resourceTypes';
import {getOwned, listResponse, resourceResponse, softDelete} from './viewset';

export const tagOrdering: OrderedSpec = {
  table: tags,
  id: tags.id,
  order: tags.order,
  dateUpdated: tags.date_updated,
  scope: tags.user_id,
};

export const tagRoutes = new Hono<AppEnv>();

/**
 * `owner`'s tags: the requester's own (`GET /tags`), or for staff another
 * user's, read-only (`GET /admin/users/:id/tags`).
 */
export const listTags = (c: Context<AppEnv>, owner: User) =>
  listResponse(c, {
    ...tagResource,
    user: owner,
    query: tagListQuerySchema,
    filters: {
      name: value => eq(tags.name, value),
      user__username: value => usernameIs(tags.user_id, value),
      date_updated__gt: value => sql`${tags.date_updated} > ${value}`,
    },
    ordering: {
      date_last_used: sql`${tags.date_last_used}`,
      date_created: sql`${tags.date_created}`,
      date_updated: sql`${tags.date_updated}`,
      entry_count: sql`${tags.entry_count}`,
      name: sql`${tags.name} COLLATE NOCASE`,
      order: sql`${tags.order}`,
    },
    defaultOrdering: [tags.date_updated, tags.id],
  });

tagRoutes.get('/', c => listTags(c, requireUser(c)));

tagRoutes.post('/reorder', c => reorder(c, {...tagResource, ...tagOrdering}));

tagRoutes.get('/:id', async c => {
  const tag = await getOwned<Tag>(c, tagResource);
  return resourceResponse(c, TAG, tag);
});

/**
 * Create a tag, or return the user's existing tag of the same name
 * (resurrecting it if it was soft-deleted). Always 201, as in Django. One
 * naming a `client_id` the user's tags already have answers with that tag,
 * whatever it is called now: a queued create retried after a lost answer is
 * made once.
 */
tagRoutes.post('/', async c => {
  const user = requireUser(c);
  const db = c.get('db');
  const {attributes} = await parseResource(c.req.raw, {type: TAG});
  const {client_id: clientId} = validateFields(
    z.pick(tagCreateAttributesSchema, {client_id: true}),
    attributes
  );
  const at = clientUpdated(c);

  const findMade = async () =>
    clientId === undefined
      ? undefined
      : (
          await db
            .select()
            .from(tags)
            .where(and(eq(tags.user_id, user.id), eq(tags.client_id, clientId)))
            .limit(1)
        )[0];
  const findByName = async (name: string) =>
    (
      await db
        .select()
        .from(tags)
        .where(and(eq(tags.user_id, user.id), eq(tags.name, name)))
        .limit(1)
    )[0];

  const named =
    typeof attributes['name'] === 'string'
      ? attributes['name'].trim()
      : undefined;
  // The user's tag of the name, as read, written only while still so (named
  // so, deleted or not as read): a write landing between the read and this
  // one (a rename, a delete, a concurrent create) makes it read again.
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    const made = await findMade();
    if (made !== undefined) {
      return resourceResponse(c, TAG, made, 201);
    }
    const existing = named === undefined ? undefined : await findByName(named);
    if (existing !== undefined) {
      // Deleted (or created) after this create was made: that stands.
      if (!appliesAfter(existing.client_updated, at)) {
        return resourceResponse(c, TAG, existing, 201);
      }
      // A tag no client named takes this create's id, so a retry finds it
      // whatever it is called by then.
      const claim =
        existing.client_id === null && clientId !== undefined
          ? {client_id: clientId}
          : {};
      const [written] = await db
        .update(tags)
        .set(
          existing.is_deleted
            ? {
                ...claim,
                is_deleted: false,
                client_updated: at,
                date_updated: nextRevision(tagResource, user.id),
              }
            : // Still a write made at `at`, which an older delete must not
              // undo. Nothing a client syncs changes: no revision advances.
              {...claim, client_updated: at}
        )
        .where(
          and(
            eq(tags.id, existing.id),
            eq(tags.name, existing.name),
            eq(tags.is_deleted, existing.is_deleted),
            writtenBefore(tags.client_updated, at)
          )
        )
        .returning();
      if (written !== undefined) {
        return resourceResponse(c, TAG, written, 201);
      }
      continue;
    }
    const {name} = validateFields(tagCreateAttributesSchema, attributes);
    const timestamp = now();
    try {
      const [created] = await db
        .insert(tags)
        .values({
          name,
          user_id: user.id,
          order: new OrderedModel(db, tagOrdering).nextOrderSql(user.id),
          date_created: timestamp,
          date_updated: nextRevision(tagResource, user.id),
          date_last_used: timestamp,
          client_id: clientId ?? null,
          client_updated: at,
        })
        .returning();
      return resourceResponse(c, TAG, created as Tag, 201);
    } catch (error) {
      // Lost a race with a concurrent create of the name, or this one's
      // retry: answer with the tag it made (the next attempt).
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }
  throw changedMeanwhile('tag');
});

tagRoutes.on(['PATCH', 'PUT'], '/:id', async c => {
  const db = c.get('db');
  const tag = await getOwned<Tag>(c, tagResource);
  const {attributes} = await parseResource(c.req.raw, {
    type: TAG,
    id: String(tag.id),
  });
  const changes = validateFields(tagUpdateAttributesSchema, attributes);
  const at = clientUpdated(c);
  try {
    // Unless a newer client write stands: then the tag as it is.
    const [updated] = await db
      .update(tags)
      .set({
        ...changes,
        client_updated: at,
        date_updated: nextRevision(tagResource, tag.user_id),
      })
      .where(and(eq(tags.id, tag.id), writtenBefore(tags.client_updated, at)))
      .returning();
    return resourceResponse(
      c,
      TAG,
      updated ?? (await getOwned<Tag>(c, tagResource))
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw uniqueTogether('name', 'user');
    }
    throw error;
  }
});

/** Tags are soft-deleted. */
tagRoutes.delete('/:id', c => softDelete(c, tagResource));
