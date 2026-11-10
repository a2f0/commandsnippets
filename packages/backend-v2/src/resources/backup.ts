/**
 * `GET /api/v1/user/backup`: a backup of the requesting user's data
 * (api-shared's `backupSchema`), for them to keep: every tag, entry, tagging
 * and reuse of theirs that is not deleted, with its id, of their active data
 * version, or of the one `?version=` names (any of theirs: one that is not
 * active never changes).
 */
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type Backup,
  DATA_VERSION,
} from '@commandsnippets/api-shared';
import {and, asc, eq} from 'drizzle-orm';
import {alias} from 'drizzle-orm/sqlite-core';
import {type Context, Hono} from 'hono';
import {requireUser} from '../auth/permissions';
import type {Db} from '../db/client';
import {
  dataVersions,
  entryReuses,
  tags,
  tagsEntries,
  textEntries,
  type User,
} from '../db/schema';
import type {AppEnv} from '../env';
import {isoformat, now} from '../lib/clock';
import {notFound} from '../lib/errors';
import {findVersionNumber, versionNumber, versionOf} from './dataVersions';

export const backupRoutes = new Hono<AppEnv>();

// A tagging's tag and entry, each its own copy of the table to join.
const taggedTag = alias(tags, 'tagged_tag');
const taggedEntry = alias(textEntries, 'tagged_entry');
const reusedEntry = alias(textEntries, 'reused_entry');

/** The version a backup is of: `?version=`, one of the user's, else theirs. */
function backupVersion(
  c: Context<AppEnv>,
  user: User
): Promise<number> | number {
  const param = c.req.query('version');
  return param === undefined
    ? versionOf(c, user)
    : versionNumber(param, version =>
        findVersionNumber(c.get('db'), user.id, version)
      );
}

/**
 * `userId`'s live rows of `version`, in one batch, so one transaction: the
 * rows are read as of one moment, and every tagging's tag and entry is
 * among the tags and entries read.
 */
function backupRowQueries(db: Db, userId: number, version: number) {
  const live = (table: typeof tags | typeof textEntries | typeof tagsEntries) =>
    and(
      eq(table.user_id, userId),
      eq(table.version, version),
      eq(table.is_deleted, false)
    );
  return [
    db
      .select({
        id: tags.id,
        name: tags.name,
        order: tags.order,
        is_public: tags.is_public,
        date_created: tags.date_created,
        date_updated: tags.date_updated,
      })
      .from(tags)
      .where(live(tags))
      .orderBy(asc(tags.order), asc(tags.id)),
    db
      .select({
        id: textEntries.id,
        subject: textEntries.subject,
        body: textEntries.body,
        is_public: textEntries.is_public,
        date_created: textEntries.date_created,
        date_updated: textEntries.date_updated,
      })
      .from(textEntries)
      .where(live(textEntries))
      .orderBy(asc(textEntries.id)),
    // A tagging of a deleted tag or entry is left out with it. (A tagging is
    // of its tag's and entry's user and version: migrations/0019 and 0021.)
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
          live(tagsEntries),
          eq(taggedTag.is_deleted, false),
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
          eq(entryReuses.user_id, userId),
          eq(entryReuses.version, version),
          eq(reusedEntry.is_deleted, false)
        )
      )
      .orderBy(asc(entryReuses.date_created), asc(entryReuses.id)),
  ] as const;
}

/** Check existence in the rows' transaction, not only before it. */
async function readBackupRows(db: Db, userId: number, version: number) {
  const [[found], ...rows] = await db.batch([
    db
      .select({version: dataVersions.version})
      .from(dataVersions)
      .where(
        and(eq(dataVersions.user_id, userId), eq(dataVersions.version, version))
      )
      .limit(1),
    ...backupRowQueries(db, userId, version),
  ]);
  if (found === undefined) {
    throw notFound(`No ${DATA_VERSION} matches the given query.`);
  }
  return rows;
}

/** The rows read, as `user`'s backup file. */
function toBackup(
  user: User,
  [tagRows, entryRows, taggingRows, reuseRows]: Awaited<
    ReturnType<typeof readBackupRows>
  >
): Backup {
  return {
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
}

backupRoutes.get('/', async c => {
  const user = requireUser(c);
  const version = await backupVersion(c, user);
  const rows = await readBackupRows(c.get('db'), user.id, version);
  return c.json(toBackup(user, rows), 200, {'Cache-Control': 'no-store'});
});
