/**
 * `GET /api/v1/user/backup`: a backup of the requesting user's data
 * (api-shared's `backupSchema`), for them to keep: every tag, entry, tagging
 * and reuse of theirs that is not deleted, with its id.
 */
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type Backup,
} from '@commandsnippets/api-shared';
import {and, asc, eq} from 'drizzle-orm';
import {alias} from 'drizzle-orm/sqlite-core';
import {Hono} from 'hono';
import {requireUser} from '../auth/permissions';
import {entryReuses, tags, tagsEntries, textEntries} from '../db/schema';
import type {AppEnv} from '../env';
import {isoformat, now} from '../lib/clock';

export const backupRoutes = new Hono<AppEnv>();

// A tagging's tag and entry, each its own copy of the table to join.
const taggedTag = alias(tags, 'tagged_tag');
const taggedEntry = alias(textEntries, 'tagged_entry');
const reusedEntry = alias(textEntries, 'reused_entry');

backupRoutes.get('/', async c => {
  const user = requireUser(c);
  const db = c.get('db');
  // One batch, so one transaction: the rows are read as of one moment, and
  // every tagging's tag and entry is among the tags and entries read.
  const [tagRows, entryRows, taggingRows, reuseRows] = await db.batch([
    db
      .select()
      .from(tags)
      .where(and(eq(tags.user_id, user.id), eq(tags.is_deleted, false)))
      .orderBy(asc(tags.order), asc(tags.id)),
    db
      .select()
      .from(textEntries)
      .where(
        and(eq(textEntries.user_id, user.id), eq(textEntries.is_deleted, false))
      )
      .orderBy(asc(textEntries.id)),
    // Rows imported from Django can tag another user's tag or entry: such a
    // tagging is left out with them.
    db
      .select({
        id: tagsEntries.id,
        tag_id: tagsEntries.tag_id,
        text_entry_id: tagsEntries.text_entry_id,
        order: tagsEntries.order,
        date_created: tagsEntries.date_created,
        date_updated: tagsEntries.date_updated,
      })
      .from(tagsEntries)
      .innerJoin(taggedTag, eq(taggedTag.id, tagsEntries.tag_id))
      .innerJoin(taggedEntry, eq(taggedEntry.id, tagsEntries.text_entry_id))
      .where(
        and(
          eq(tagsEntries.user_id, user.id),
          eq(tagsEntries.is_deleted, false),
          eq(taggedTag.user_id, user.id),
          eq(taggedTag.is_deleted, false),
          eq(taggedEntry.user_id, user.id),
          eq(taggedEntry.is_deleted, false)
        )
      )
      .orderBy(
        asc(tagsEntries.tag_id),
        asc(tagsEntries.order),
        asc(tagsEntries.id)
      ),
    db
      .select({
        id: entryReuses.id,
        text_entry_id: entryReuses.text_entry_id,
        date_created: entryReuses.date_created,
      })
      .from(entryReuses)
      .innerJoin(reusedEntry, eq(reusedEntry.id, entryReuses.text_entry_id))
      .where(
        and(
          eq(entryReuses.user_id, user.id),
          eq(reusedEntry.user_id, user.id),
          eq(reusedEntry.is_deleted, false)
        )
      )
      .orderBy(asc(entryReuses.date_created), asc(entryReuses.id)),
  ]);
  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    date_exported: isoformat(now()),
    user: {id: String(user.id), username: user.username},
    tags: tagRows.map(row => ({
      id: String(row.id),
      name: row.name,
      order: row.order,
      is_public: row.is_public,
      date_created: isoformat(row.date_created),
      date_updated: isoformat(row.date_updated),
    })),
    entries: entryRows.map(row => ({
      id: String(row.id),
      subject: row.subject,
      body: row.body,
      is_public: row.is_public,
      date_created: isoformat(row.date_created),
      date_updated: isoformat(row.date_updated),
    })),
    tags_entries: taggingRows.map(row => ({
      id: String(row.id),
      tag_id: String(row.tag_id),
      text_entry_id: String(row.text_entry_id),
      order: row.order,
      date_created: isoformat(row.date_created),
      date_updated: isoformat(row.date_updated),
    })),
    entry_reuses: reuseRows.map(row => ({
      id: String(row.id),
      text_entry_id: String(row.text_entry_id),
      date_created: isoformat(row.date_created),
    })),
  };
  return c.json(backup, 200, {'Cache-Control': 'no-store'});
});
