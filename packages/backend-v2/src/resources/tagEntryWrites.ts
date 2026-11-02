/**
 * Tagging and untagging: the junction writes of `tagsEntries.ts`, each
 * made only while the junction is as read (`lww.ts`), each advancing the
 * entry the junction joins when it applies.
 */
import {and, eq, sql} from 'drizzle-orm';
import type {Db} from '../db/client';
import {isUniqueViolation} from '../db/errors';
import {type TagTextEntry, tagsEntries, textEntries} from '../db/schema';
import {now} from '../lib/clock';
import {OrderedModel} from '../lib/ordered';
import {appliesAfter, writtenBefore} from './lww';
import {tagEntryOrdering} from './orderings';
import {nextRevision, tagTextEntryResource, textEntryResource} from './owned';

/** A tagging, as the request makes it. */
export interface Tagging {
  db: Db;
  userId: number;
  version: number;
  tagId: number;
  textEntryId: number;
  /** When it was made (`clientUpdated`). */
  at: string;
}

/**
 * Advance an entry's revision when the junction write batched before it
 * applied (`changes()` counts only that statement's own rows, not triggers'),
 * scoped to the requester's own entries. The entry's trigger then advances its
 * tags; the junction's own triggers advance the tag it joined or left
 * (migrations/0008_tag_revisions.sql).
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

/** The pair's junction, deleted or not. */
export async function findJunction({
  db,
  tagId,
  textEntryId,
}: Tagging): Promise<TagTextEntry | undefined> {
  const [junction] = await db
    .select()
    .from(tagsEntries)
    .where(
      and(
        eq(tagsEntries.tag_id, tagId),
        eq(tagsEntries.text_entry_id, textEntryId)
      )
    )
    .limit(1);
  return junction;
}

/**
 * A new junction for the pair, at the bottom of the tag, or undefined when
 * the pair has one (a concurrent tagging made it first).
 */
export async function insertJunction(
  tagging: Tagging
): Promise<TagTextEntry | undefined> {
  const {db, userId, version, tagId, textEntryId, at} = tagging;
  try {
    const [[created]] = await db.batch([
      db
        .insert(tagsEntries)
        .values({
          tag_id: tagId,
          text_entry_id: textEntryId,
          user_id: userId,
          version,
          order: new OrderedModel(db, tagEntryOrdering).nextOrderSql(tagId),
          date_created: now(),
          date_updated: nextRevision(tagTextEntryResource, userId),
          client_updated: at,
        })
        .returning(),
      touchEntry(db, textEntryId, userId),
    ]);
    return created;
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
    return undefined;
  }
}

/**
 * Tag the pair again with its junction as read: what stands when it was
 * untagged (or tagged) after this tagging was made; else the junction
 * written, or undefined when a write landed between the read and this one.
 */
export async function retag(
  {db, userId, tagId, textEntryId, at}: Tagging,
  junction: TagTextEntry
): Promise<TagTextEntry | undefined> {
  if (!appliesAfter(junction.client_updated, at)) {
    return junction;
  }
  const asRead = (deleted: boolean) =>
    and(
      eq(tagsEntries.id, junction.id),
      eq(tagsEntries.user_id, userId),
      eq(tagsEntries.is_deleted, deleted),
      writtenBefore(tagsEntries.client_updated, at)
    );
  if (!junction.is_deleted) {
    // Already tagged: still a write made at `at`, which an older untag must
    // not undo. Nothing a client syncs changes, so no revision advances.
    const [stamped] = await db
      .update(tagsEntries)
      .set({client_updated: at})
      .where(asRead(false))
      .returning();
    return stamped;
  }
  // Untagged before this tagging was made: it comes back, as a new
  // junction would, at the bottom of the tag.
  const [[written]] = await db.batch([
    db
      .update(tagsEntries)
      .set({
        is_deleted: false,
        order: new OrderedModel(db, tagEntryOrdering).nextOrderSql(tagId),
        date_created: now(),
        date_updated: nextRevision(tagTextEntryResource, userId),
        client_updated: at,
      })
      .where(asRead(true))
      .returning(),
    touchEntry(db, textEntryId, userId),
  ]);
  return written;
}

/**
 * Untag the junction as read: what stands when a newer client write does
 * (a tagging made after this untag); else the junction written (one already
 * untagged only takes this untag's time, so an older tagging cannot bring it
 * back), or undefined when a write landed between the read and this one.
 */
export async function untag(
  db: Db,
  junction: TagTextEntry,
  at: string
): Promise<TagTextEntry | undefined> {
  if (!appliesAfter(junction.client_updated, at)) {
    return junction;
  }
  const asRead = and(
    eq(tagsEntries.id, junction.id),
    eq(tagsEntries.is_deleted, junction.is_deleted),
    writtenBefore(tagsEntries.client_updated, at)
  );
  if (junction.is_deleted) {
    const [written] = await db
      .update(tagsEntries)
      .set({client_updated: at})
      .where(asRead)
      .returning();
    return written;
  }
  const [[written]] = await db.batch([
    db
      .update(tagsEntries)
      .set({
        is_deleted: true,
        client_updated: at,
        date_updated: nextRevision(tagTextEntryResource, junction.user_id),
      })
      .where(asRead)
      .returning(),
    touchEntry(db, junction.text_entry_id, junction.user_id),
  ]);
  return written;
}
