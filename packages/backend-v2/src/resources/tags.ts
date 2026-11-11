import {
  tagListQuerySchema,
  tagUpdateAttributesSchema,
} from '@commandsnippets/api-shared';
import {eq, sql} from 'drizzle-orm';
import {type Context, Hono} from 'hono';
import {requireUser} from '../auth/permissions';
import {isUniqueViolation} from '../db/errors';
import {type Tag, tags, type User} from '../db/schema';
import type {AppEnv} from '../env';
import {uniqueTogether} from '../lib/errors';
import {parseResource} from '../lib/jsonapi/request';
import {validateFields} from '../lib/validate';
import {versionOf} from './dataVersions';
import {tagOrdering} from './orderings';
import {tagResource} from './owned';
import {
  publicEntryCount,
  publicLastUsed,
  publicTag,
  publicTagFields,
} from './publicPolicy';
import {reorder} from './reorder';
import {TAG} from './resourceTypes';
import {createTag} from './tagCreate';
import {
  getOwned,
  listResponse,
  resourceResponse,
  softDelete,
  writeOwned,
} from './viewset';

export const tagRoutes = new Hono<AppEnv>();

/**
 * `owner`'s tags: the requester's own (`GET /tags`), or for staff another
 * user's, read-only (`GET /admin/users/:id/tags`).
 */
export const listTags = (c: Context<AppEnv>, owner: User, publicOnly = false) =>
  listResponse(c, {
    ...tagResource,
    user: owner,
    ...(publicOnly
      ? {
          publicOnly: true,
          visibility: publicTag(owner.id),
          fields: publicTagFields(owner.id),
        }
      : {publicOnly: false}),
    query: tagListQuerySchema,
    filters: {
      name: value => eq(tags.name, value),
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

tagRoutes.post('/', createTag);

tagRoutes.on(['PATCH', 'PUT'], '/:id', async c => {
  const tag = await getOwned<Tag>(c, tagResource);
  const {attributes} = await parseResource(c.req.raw, {
    type: TAG,
    id: String(tag.id),
  });
  const changes = validateFields(tagUpdateAttributesSchema, attributes);
  try {
    return await writeOwned(c, tagResource, tag, changes);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw uniqueTogether('name', 'user');
    }
    throw error;
  }
});

/** Tags are soft-deleted. */
tagRoutes.delete('/:id', c => softDelete(c, tagResource));
