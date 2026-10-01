import {
  tagTextEntryCreateRelationshipsSchema,
  tagTextEntryListQuerySchema,
} from '@commandsnippets/api-shared';
import {and, eq, sql} from 'drizzle-orm';
import {type Context, Hono} from 'hono';
import {requireUser} from '../auth/permissions';
import type {Db} from '../db/client';
import {isUniqueViolation} from '../db/errors';
import {
  type TagTextEntry,
  tagsEntries,
  textEntries,
  type User,
} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {methodNotAllowed} from '../lib/errors';
import {parseResource} from '../lib/jsonapi';
import {OrderedModel, type OrderedSpec} from '../lib/ordered';
import {
  appliesAfter,
  changedMeanwhile,
  clientUpdated,
  WRITE_ATTEMPTS,
  writtenBefore,
} from './lww';
import {
  nextRevision,
  tagResource,
  tagTextEntryResource,
  textEntryResource,
} from './owned';
import {resolveRelated} from './related';
import {reorder} from './reorder';
import {TAG_TEXT_ENTRY} from './resourceTypes';
import {getOwned, listResponse, resourceResponse} from './viewset';

export const tagEntryOrdering: OrderedSpec = {
  table: tagsEntries,
  id: tagsEntries.id,
  order: tagsEntries.order,
  dateUpdated: tagsEntries.date_updated,
  scope: tagsEntries.tag_id,
  // Imported Django data can put another user's junction in a user's tag.
  owner: tagsEntries.user_id,
  // A deleted junction is out of its tag's order (it keeps its old rank).
  ranked: sql`${tagsEntries.is_deleted} = 0`,
  // Clients sync junctions as /entries includes, filtered on the entry's
  // revision: advance the entries whose junctions a move re-ranked (their
  // trigger advances the tag, migrations/0008_tag_revisions.sql, and the
  // entry's junctions, 0010_junction_revisions.sql). The tag's junction list
  // sees the move itself: the shifted junctions carry its revision.
  // The moved junctions carry the owner's newest junction revision; nothing is
  // touched if the move's guarded UPDATE did not apply.
  touch: moved => sql`
    UPDATE ${textEntries}
    SET ${sql.identifier('date_updated')} = ${nextRevision(
      textEntryResource,
      moved.owner as number
    )}
    WHERE changes() > 0
      AND ${textEntries.user_id} = ${moved.owner}
      AND ${textEntries.id} IN (
        SELECT j.text_entry_id FROM ${tagsEntries} AS j
        WHERE j.tag_id = ${moved.scope}
          AND j.user_id = ${moved.owner}
          AND j.date_updated = (
            SELECT MAX(date_updated) FROM ${tagsEntries}
            WHERE user_id = ${moved.owner}
          )
      )
  `,
};

/**
 * Advance an entry's revision when the junction write batched before it
 * applied (`changes()` counts only that statement's own rows, not triggers').
 * Only the requester's own entries: legacy junctions can link another user's.
 * The entry's trigger then advances its tags; the junction's own triggers
 * advance the tag it joined or left (migrations/0008_tag_revisions.sql).
 */
const touchEntry = (db: Db, entryId: number, userId: number) =>
  db
    .update(textEntries)
    .set({date_updated: nextRevision(textEntryResource, userId)})
    .where(
      and(
        sql`changes() > 0`,
        eq(textEntries.id, entryId),
        eq(textEntries.user_id, userId)
      )
    );

/** List, create, destroy and reorder are routed. */
export const tagEntryRoutes = new Hono<AppEnv>();

/**
 * `owner`'s junctions, deleted ones too, by default in revision order: after
 * a cursor (`page[after]`), a tag's (`filter[tag.id]`) are what changed in
 * it since. The requester's own (`GET /tags_entries`), or for staff another
 * user's, read-only (`GET /admin/users/:id/tags_entries`).
 */
export const listTagEntries = (c: Context<AppEnv>, owner: User) =>
  listResponse(c, {
    ...tagTextEntryResource,
    user: owner,
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
  reorder(c, {...tagTextEntryResource, ...tagEntryOrdering})
);

/**
 * Tag an entry: get_or_create on (tag, text_entry), restoring the pair's
 * deleted junction (at the bottom of the tag, as a new one would be). Always
 * 201.
 */
tagEntryRoutes.post('/', async c => {
  const user = requireUser(c);
  const db = c.get('db');
  const {relationships} = await parseResource(c.req.raw, {
    type: TAG_TEXT_ENTRY,
  });
  const {tag: tagId, text_entry: textEntryId} = await resolveRelated(
    db,
    user.id,
    relationships,
    tagTextEntryCreateRelationshipsSchema,
    {tag: tagResource, text_entry: textEntryResource}
  );
  const at = await clientUpdated(c);

  const find = async () =>
    (
      await db
        .select()
        .from(tagsEntries)
        .where(
          and(
            eq(tagsEntries.tag_id, tagId),
            eq(tagsEntries.text_entry_id, textEntryId)
          )
        )
        .limit(1)
    )[0];

  let junction = await find();
  if (junction === undefined) {
    const timestamp = now();
    try {
      const [inserted] = await db.batch([
        db
          .insert(tagsEntries)
          .values({
            tag_id: tagId,
            text_entry_id: textEntryId,
            user_id: user.id,
            order: new OrderedModel(db, tagEntryOrdering).nextOrderSql(tagId),
            date_created: timestamp,
            date_updated: nextRevision(tagTextEntryResource, user.id),
            client_updated: at,
          })
          .returning(),
        touchEntry(db, textEntryId, user.id),
      ]);
      const [created] = inserted;
      if (created !== undefined) {
        return resourceResponse(c, TAG_TEXT_ENTRY, created, 201);
      }
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
    junction = await find();
  }
  // The pair's junction, as read: written only while still so (a write
  // landing between the read and this one makes it read again).
  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt += 1) {
    if (junction === undefined) {
      break;
    }
    const {id, user_id, is_deleted} = junction;
    const own = user_id === user.id;
    // Untagged (or tagged) after this tagging was made: that stands. (Only
    // for the user's own junction: another's is always taken over below, so
    // it is never answered with.)
    if (own && !appliesAfter(junction.client_updated, at)) {
      return resourceResponse(c, TAG_TEXT_ENTRY, junction, 201);
    }
    if (own && !is_deleted) {
      // Already tagged: still a write made at `at`, which an older untag must
      // not undo. Nothing a client syncs changes, so no revision advances.
      const [stamped] = await db
        .update(tagsEntries)
        .set({client_updated: at})
        .where(
          and(
            eq(tagsEntries.id, id),
            eq(tagsEntries.user_id, user.id),
            eq(tagsEntries.is_deleted, false),
            writtenBefore(tagsEntries.client_updated, at)
          )
        )
        .returning();
      if (stamped !== undefined) {
        return resourceResponse(c, TAG_TEXT_ENTRY, stamped, 201);
      }
    } else {
      // Imported Django data can hold a junction owned by another user
      // between this user's own tag and entry. It links only their data, so
      // it is theirs: take it over rather than return someone else's row. A
      // deleted one comes back, as a new junction would: at the bottom of
      // the tag.
      const restore = is_deleted
        ? {
            is_deleted: false,
            order: new OrderedModel(db, tagEntryOrdering).nextOrderSql(tagId),
            date_created: now(),
          }
        : {};
      const [updated] = await db.batch([
        db
          .update(tagsEntries)
          .set({
            user_id: user.id,
            date_updated: nextRevision(tagTextEntryResource, user.id),
            client_updated: at,
            ...restore,
          })
          .where(
            and(
              eq(tagsEntries.id, id),
              eq(tagsEntries.user_id, user_id),
              eq(tagsEntries.is_deleted, is_deleted),
              // Another user's (legacy) writes do not count against this one.
              own ? writtenBefore(tagsEntries.client_updated, at) : undefined
            )
          )
          .returning(),
        touchEntry(db, textEntryId, user.id),
      ]);
      const [written] = updated;
      if (written !== undefined) {
        return resourceResponse(c, TAG_TEXT_ENTRY, written, 201);
      }
    }
    junction = await find();
  }
  throw changedMeanwhile('tag');
});

/**
 * Untag: soft-delete the junction, unless a newer client write stands (a
 * tagging made after this untag). The response is the junction either way:
 * untagging one already untagged changes nothing but the time of its last
 * write (so an older tagging cannot bring it back), and a retried untag is
 * answered as the first was.
 */
tagEntryRoutes.delete('/:id', async c => {
  let junction = await getOwned<TagTextEntry>(c, tagTextEntryResource);
  const at = await clientUpdated(c);
  const db = c.get('db');
  // Written only while still as read (see the tagging above).
  for (let attempt = 0; ; attempt += 1) {
    if (!appliesAfter(junction.client_updated, at)) {
      break;
    }
    let written: TagTextEntry | undefined;
    if (junction.is_deleted) {
      [written] = await db
        .update(tagsEntries)
        .set({client_updated: at})
        .where(
          and(
            eq(tagsEntries.id, junction.id),
            eq(tagsEntries.is_deleted, true),
            writtenBefore(tagsEntries.client_updated, at)
          )
        )
        .returning();
    } else {
      const [untagged] = await db.batch([
        db
          .update(tagsEntries)
          .set({
            is_deleted: true,
            client_updated: at,
            date_updated: nextRevision(tagTextEntryResource, junction.user_id),
          })
          .where(
            and(
              eq(tagsEntries.id, junction.id),
              eq(tagsEntries.is_deleted, false),
              writtenBefore(tagsEntries.client_updated, at)
            )
          )
          .returning(),
        touchEntry(db, junction.text_entry_id, junction.user_id),
      ]);
      [written] = untagged;
    }
    if (written !== undefined) {
      junction = written;
      break;
    }
    if (attempt + 1 >= WRITE_ATTEMPTS) {
      throw changedMeanwhile('tag');
    }
    junction = await getOwned<TagTextEntry>(c, tagTextEntryResource);
  }
  return resourceResponse(c, TAG_TEXT_ENTRY, junction);
});

tagEntryRoutes.on(['PATCH', 'PUT'], ['/', '/:id'], c => {
  throw methodNotAllowed(c.req.method);
});

tagEntryRoutes.get('/:id', c => {
  throw methodNotAllowed(c.req.method);
});
