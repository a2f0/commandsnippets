import {
  tagCreateAttributesSchema,
  tagListQuerySchema,
  tagUpdateAttributesSchema,
} from '@commandsnippets/api-shared';
import {and, eq, sql} from 'drizzle-orm';
import {Hono} from 'hono';
import {requireUser} from '../auth/permissions';
import {isUniqueViolation} from '../db/errors';
import {type Tag, tags} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {uniqueTogether} from '../lib/errors';
import {parseResource} from '../lib/jsonapi';
import {OrderedModel, type OrderedSpec} from '../lib/ordered';
import {validateFields} from '../lib/validate';
import {usernameIs} from './filters';
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

tagRoutes.get('/', c =>
  listResponse(c, {
    ...tagResource,
    user: requireUser(c),
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
  })
);

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
        return resourceResponse(c, TAG, existing, 201);
      }
      const [resurrected] = await db
        .update(tags)
        .set({
          is_deleted: false,
          date_updated: nextRevision(tagResource, user.id),
        })
        .where(eq(tags.id, existing.id))
        .returning();
      return resourceResponse(c, TAG, resurrected as Tag, 201);
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
  try {
    const [updated] = await db
      .update(tags)
      .set({
        ...changes,
        date_updated: nextRevision(tagResource, tag.user_id),
      })
      .where(eq(tags.id, tag.id))
      .returning();
    return resourceResponse(c, TAG, updated as Tag);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw uniqueTogether('name', 'user');
    }
    throw error;
  }
});

/** Tags are soft-deleted. */
tagRoutes.delete('/:id', c => softDelete(c, tagResource));
