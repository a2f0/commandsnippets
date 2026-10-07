import {
  tagCreateAttributesSchema,
  tagListQuerySchema,
  tagUpdateAttributesSchema,
} from '@commandsnippets/api-shared';
import {and, eq, inArray, type SQL, sql} from 'drizzle-orm';
import {type Context, Hono} from 'hono';
import * as z from 'zod/mini';
import {requireUser} from '../auth/permissions';
import {isNotNullViolation, isUniqueViolation} from '../db/errors';
import {type Tag, tagClientIds, tags, type User} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {uniqueTogether} from '../lib/errors';
import {parseResource} from '../lib/jsonapi';
import {OrderedModel, type OrderedSpec} from '../lib/ordered';
import {validateFields} from '../lib/validate';
import {versionOf} from './dataVersions';
import {usernameIs} from './filters';
import {
  appliesAfter,
  changedMeanwhile,
  clientUpdated,
  WRITE_ATTEMPTS,
  writtenBefore,
} from './lww';
import {nextRevision, tagResource} from './owned';
import {
  publicEntryCount,
  publicLastUsed,
  publicTag,
  publicTagFields,
} from './publicPolicy';
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
export const listTags = (c: Context<AppEnv>, owner: User, publicOnly = false) =>
  listResponse(c, {
    ...tagResource,
    user: owner,
    dataVersion: versionOf(c, owner),
    publicOnly,
    ...(publicOnly
      ? {visibility: publicTag(owner.id), fields: publicTagFields(owner.id)}
      : {}),
    query: tagListQuerySchema,
    filters: {
      name: value => eq(tags.name, value),
      user__username: value => usernameIs(tags.user_id, value),
      date_updated__gt: value => sql`${tags.date_updated} > ${value}`,
    },
    ordering: {
      date_last_used: publicOnly
        ? publicLastUsed(owner.id)
        : sql`${tags.date_last_used}`,
      date_created: sql`${tags.date_created}`,
      date_updated: sql`${tags.date_updated}`,
      entry_count: publicOnly
        ? publicEntryCount(owner.id)
        : sql`${tags.entry_count}`,
      name: sql`${tags.name} COLLATE NOCASE`,
      order: sql`${tags.order}`,
    },
    defaultOrdering: [tags.date_updated, tags.id],
  });

tagRoutes.get('/', c => listTags(c, requireUser(c)));

// Only the version written holds a place in the order: rows of another are
// never shifted, moved, or positioned against.
tagRoutes.post('/reorder', c =>
  reorder(c, {
    ...tagResource,
    ...tagOrdering,
    ranked: eq(tags.version, versionOf(c, requireUser(c))),
  })
);

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
  const version = versionOf(c, user);
  const db = c.get('db');
  const {attributes} = await parseResource(c.req.raw, {type: TAG});
  const {client_id: clientId} = validateFields(
    z.pick(tagCreateAttributesSchema, {client_id: true}),
    attributes
  );
  const at = await clientUpdated(c);

  // The tag this create made, or was answered with, before (its answer was
  // lost): by its client id, whatever the tag is named by then.
  const findMade = async () =>
    clientId === undefined
      ? undefined
      : (
          await db
            .select()
            .from(tags)
            .where(
              and(
                eq(tags.version, version),
                inArray(
                  tags.id,
                  db
                    .select({id: tagClientIds.tag_id})
                    .from(tagClientIds)
                    .where(
                      and(
                        eq(tagClientIds.user_id, user.id),
                        eq(tagClientIds.client_id, clientId)
                      )
                    )
                )
              )
            )
            .limit(1)
        )[0];
  // The statement reserving this create's client id for the tag `which`
  // finds when it runs, ending the batch of the write it answers with: so
  // the client id names one tag, the one the create was answered with. A
  // clash (another attempt of this create reserved it first) or no such tag
  // any more fails the batch, which is undone, and the create reads again.
  const reserve = (which: SQL) =>
    db.insert(tagClientIds).values({
      user_id: user.id,
      client_id: clientId ?? '',
      tag_id: sql`(SELECT ${tags.id} FROM ${tags} WHERE ${which})`,
    });
  const lostRace = (error: unknown) =>
    isUniqueViolation(error) ||
    isNotNullViolation(error, 'tags_tagclientid.tag_id');
  const findByName = async (name: string) =>
    (
      await db
        .select()
        .from(tags)
        .where(
          and(
            eq(tags.user_id, user.id),
            eq(tags.version, version),
            eq(tags.name, name)
          )
        )
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
    const asRead =
      existing === undefined
        ? undefined
        : and(
            eq(tags.id, existing.id),
            eq(tags.name, existing.name),
            eq(tags.is_deleted, existing.is_deleted)
          );
    try {
      if (existing !== undefined && asRead !== undefined) {
        // Deleted (or created) after this create was made: that stands.
        if (!appliesAfter(existing.client_updated, at)) {
          if (clientId !== undefined) {
            await reserve(asRead);
          }
          return resourceResponse(c, TAG, existing, 201);
        }
        const update = db
          .update(tags)
          .set(
            existing.is_deleted
              ? {
                  is_deleted: false,
                  client_updated: at,
                  date_updated: nextRevision(tagResource, user.id),
                }
              : // Still a write made at `at`, which an older delete must not
                // undo. Nothing a client syncs changes: no revision advances.
                {client_updated: at}
          )
          .where(and(asRead, writtenBefore(tags.client_updated, at)))
          .returning();
        const [written] =
          clientId === undefined
            ? await update
            : (
                await db.batch([
                  update,
                  // The tag as this update left it.
                  reserve(
                    and(
                      eq(tags.id, existing.id),
                      eq(tags.name, existing.name),
                      eq(tags.is_deleted, false),
                      eq(tags.client_updated, at)
                    ) ?? sql`0`
                  ),
                ])
              )[0];
        if (written !== undefined) {
          return resourceResponse(c, TAG, written, 201);
        }
        continue;
      }
      const {name} = validateFields(tagCreateAttributesSchema, attributes);
      const timestamp = now();
      const insert = db
        .insert(tags)
        .values({
          name,
          user_id: user.id,
          version,
          order: new OrderedModel(db, tagOrdering).nextOrderSql(user.id),
          date_created: timestamp,
          date_updated: nextRevision(tagResource, user.id),
          date_last_used: timestamp,
          client_id: clientId ?? null,
          client_updated: at,
        })
        .returning();
      const [created] =
        clientId === undefined
          ? await insert
          : (
              await db.batch([
                insert,
                reserve(
                  and(
                    eq(tags.user_id, user.id),
                    eq(tags.version, version),
                    eq(tags.name, name)
                  ) ?? sql`0`
                ),
              ])
            )[0];
      return resourceResponse(c, TAG, created as Tag, 201);
    } catch (error) {
      // Lost a race: with a concurrent create of the name, or with another
      // attempt of this create (the next attempt answers with its tag).
      if (!lostRace(error)) {
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
  const at = await clientUpdated(c);
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
