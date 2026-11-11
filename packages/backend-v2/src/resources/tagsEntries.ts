import {
  tagTextEntryCreateRelationshipsSchema,
  tagTextEntryListQuerySchema,
} from '@commandsnippets/api-shared';
import {and, eq, sql} from 'drizzle-orm';
import {type Context, Hono} from 'hono';
import {requireUser} from '../auth/permissions';
import {type TagTextEntry, tagsEntries, type User} from '../db/schema';
import type {AppEnv} from '../env';
import {methodNotAllowed} from '../lib/errors';
import {parseResource} from '../lib/jsonapi/request';
import {requireSql} from '../lib/sqlConditions';
import {versionOf} from './dataVersions';
import {changedMeanwhile, clientUpdated, retryWrite} from './lww';
import {tagEntryOrdering} from './orderings';
import {tagResource, tagTextEntryResource, textEntryResource} from './owned';
import {publicJunction} from './publicPolicy';
import {resolveRelated} from './related';
import {reorder} from './reorder';
import {TAG_TEXT_ENTRY} from './resourceTypes';
import {
  findJunction,
  insertJunction,
  retag,
  type Tagging,
  untag,
} from './tagEntryWrites';
import {getOwned, listResponse, resourceResponse} from './viewset';

/** List, create, destroy and reorder are routed. */
export const tagEntryRoutes = new Hono<AppEnv>();

/**
 * `owner`'s junctions, deleted ones too, by default in revision order: after
 * a cursor (`page[after]`), a tag's (`filter[tag.id]`) are what changed in
 * it since. The requester's own (`GET /tags_entries`), or for staff another
 * user's, read-only (`GET /admin/users/:id/tags_entries`).
 */
export const listTagEntries = (
  c: Context<AppEnv>,
  owner: User,
  publicOnly = false
) =>
  listResponse(c, {
    ...tagTextEntryResource,
    user: owner,
    publicOnly,
    ...(publicOnly ? {visibility: publicJunction(owner.id)} : {}),
    query: tagTextEntryListQuerySchema,
    filters: {
      tag__id: value => eq(tagsEntries.tag_id, value),
      text_entry__id: value => eq(tagsEntries.text_entry_id, value),
      is_deleted: value => eq(tagsEntries.is_deleted, value),
      date_updated__gt: value => sql`${tagsEntries.date_updated} > ${value}`,
    },
    ordering: {date_updated: sql`${tagsEntries.date_updated}`},
    defaultOrdering: [tagsEntries.date_updated, tagsEntries.id],
  });

tagEntryRoutes.get('/', c => listTagEntries(c, requireUser(c)));

tagEntryRoutes.post('/reorder', c =>
  reorder(c, {
    ...tagTextEntryResource,
    ...tagEntryOrdering,
    // A tag's junctions are of its version: one of another is no row here.
    ranked: requireSql(
      and(
        tagEntryOrdering.ranked,
        eq(tagsEntries.version, versionOf(c, requireUser(c)))
      )
    ),
  })
);

/**
 * Tag an entry: get_or_create on (tag, text_entry): a new junction is 201;
 * the pair's junction there is (restored, at the bottom of the tag as a new
 * one would be, if it was untagged) is 200.
 */
tagEntryRoutes.post('/', async c => {
  const user = requireUser(c);
  const version = versionOf(c, user);
  const db = c.get('db');
  const {relationships} = await parseResource(c.req.raw, {
    type: TAG_TEXT_ENTRY,
  });
  const {tag: tagId, text_entry: textEntryId} = await resolveRelated(
    db,
    user.id,
    version,
    relationships,
    tagTextEntryCreateRelationshipsSchema,
    {tag: tagResource, text_entry: textEntryResource}
  );
  const tagging: Tagging = {
    db,
    userId: user.id,
    version,
    tagId,
    textEntryId,
    at: await clientUpdated(c),
  };
  let junction = await findJunction(tagging);
  if (junction === undefined) {
    const created = await insertJunction(tagging);
    if (created !== undefined) {
      return resourceResponse(c, TAG_TEXT_ENTRY, created, 201);
    }
    junction = await findJunction(tagging);
  }
  // The pair's junction, as read: written only while still so.
  const written = await retryWrite(
    junction,
    () => findJunction(tagging),
    async row => {
      if (row === undefined) {
        throw changedMeanwhile('tag');
      }
      return retag(tagging, row);
    },
    'tag'
  );
  return resourceResponse(c, TAG_TEXT_ENTRY, written, 200);
});

/**
 * Untag: soft-delete the junction, unless a newer client write stands (a
 * tagging made after this untag). The response is the junction either way:
 * untagging one already untagged changes nothing but the time of its last
 * write (so an older tagging cannot bring it back), and a retried untag is
 * answered as the first was.
 */
tagEntryRoutes.delete('/:id', async c => {
  const junction = await getOwned<TagTextEntry>(c, tagTextEntryResource);
  const at = await clientUpdated(c);
  const db = c.get('db');
  const written = await retryWrite(
    junction,
    () => getOwned<TagTextEntry>(c, tagTextEntryResource),
    row => untag(db, row, at),
    'tag'
  );
  return resourceResponse(c, TAG_TEXT_ENTRY, written);
});

tagEntryRoutes.on(['PATCH', 'PUT'], ['/', '/:id'], c => {
  throw methodNotAllowed(c.req.method);
});

tagEntryRoutes.get('/:id', c => {
  throw methodNotAllowed(c.req.method);
});
