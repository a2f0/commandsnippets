import {
  tagCreateAttributesSchema,
  tagListQuerySchema,
  tagUpdateAttributesSchema,
} from '@commandsnippets/api-shared';
import {and, eq, sql} from 'drizzle-orm';
import {type Context, Hono} from 'hono';
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
import {clientUpdated, writtenBefore} from './lww';
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
 * (resurrecting it if it was soft-deleted). Always 201, as in Django.
 */
tagRoutes.post('/', async c => {
  const user = requireUser(c);
  const db = c.get('db');
  const {attributes} = await parseResource(c.req.raw, {type: TAG});
  const at = clientUpdated(c);

  const findByName = async (name: string) =>
    (
      await db
        .select()
        .from(tags)
        .where(and(eq(tags.user_id, user.id), eq(tags.name, name)))
        .limit(1)
    )[0];

  if (typeof attributes['name'] === 'string') {
    const existing = await findByName(attributes['name'].trim());
    if (existing !== undefined) {
      if (!existing.is_deleted) {
        // Still a write made at `at`, which an older delete must not undo.
        // Nothing a client syncs changes, so no revision advances.
        await db
          .update(tags)
          .set({client_updated: at})
          .where(
            and(
              eq(tags.id, existing.id),
              writtenBefore(tags.client_updated, at)
            )
          );
        return resourceResponse(c, TAG, existing, 201);
      }
      // Unless deleted after this create was made: the delete stands.
      const [resurrected] = await db
        .update(tags)
        .set({
          is_deleted: false,
          client_updated: at,
          date_updated: nextRevision(tagResource, user.id),
        })
        .where(
          and(eq(tags.id, existing.id), writtenBefore(tags.client_updated, at))
        )
        .returning();
      return resourceResponse(c, TAG, resurrected ?? existing, 201);
    }
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
        client_updated: at,
      })
      .returning();
    return resourceResponse(c, TAG, created as Tag, 201);
  } catch (error) {
    // Lost a race with a concurrent create of the same name.
    const existing = isUniqueViolation(error)
      ? await findByName(name)
      : undefined;
    if (existing === undefined) {
      throw error;
    }
    return resourceResponse(c, TAG, existing, 201);
  }
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
