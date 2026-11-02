/**
 * `POST /api/v1/user/restore`: make a backup (api-shared's `backupSchema`,
 * whoever's it is, so data can move between accounts) the requester's data,
 * as a new data version (`dataVersions.ts`) made active. Nothing is deleted:
 * the version before is kept as it was, to make active again, export or
 * delete. The backup's rows are made anew in the new version, with ids of
 * their own and their `date_created`, tags in the backup's order and
 * taggings in their tag's, in one D1 batch: one transaction, so all of it
 * happens or none of it. Every client's copy of the data is then of another
 * version than the active one, and syncs it again; a write queued against
 * the version before is refused (`0019_data_versions.sql`).
 */
import {backupSchema, type RestoreResult} from '@commandsnippets/api-shared';
import {type SQL, sql} from 'drizzle-orm';
import {Hono} from 'hono';
import {requireUser} from '../auth/permissions';
import {type Db, rawBatch} from '../db/client';
import {isVersionClash} from '../db/errors';
import {
  dataVersions,
  entryReuses,
  tags,
  tagsEntries,
  textEntries,
  users,
} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {dataVersionChanged} from '../lib/errors';
import {readJson} from '../lib/jsonapi/request';
import {versionOf} from './dataVersions';
import {
  nextRevision,
  tagResource,
  tagTextEntryResource,
  textEntryResource,
} from './owned';
import {
  CHUNK_BYTES,
  chunked,
  parsed,
  prepareRestore,
  type Restore,
} from './restorePlan';

export const restoreRoutes = new Hono<AppEnv>();

const field = (name: string, from: SQL = sql`value`) =>
  sql`json_extract(${from}, ${`$.${name}`})`;

/**
 * The statements that make a restore's data version: numbered (one past
 * the last given out), recorded and made active first, so the rows written
 * next are of the active version, as the data version triggers require.
 */
function versionStatements(db: Db, userId: number, restore: Restore): SQL[] {
  const user = sql`${users.id} = ${userId}`;
  return [
    db
      .update(users)
      .set({last_version: sql`${users.last_version} + 1`})
      .where(user)
      .getSQL(),
    sql`INSERT INTO ${dataVersions} (
        "user_id", "version", "date_created", "origin", "backup_username", "backup_exported"
      )
      SELECT ${userId}, ${users.last_version}, ${now()}, 'restore',
        ${restore.source.username}, ${restore.source.exported}
      FROM ${users} WHERE ${user}`,
    // The public view (`public_revision`) is of the active version too.
    db
      .update(users)
      .set({
        active_version: sql`${users.last_version}`,
        public_revision: sql`${users.public_revision} + 1`,
      })
      .where(user)
      .getSQL(),
  ];
}

/**
 * The statements that make a restore's rows in `userId`'s active version,
 * in runs of at most `chunkBytes` of JSON. Its entries, all made here, in
 * order, have the backup's entry indexes as their row numbers.
 */
function rowInserts(
  userId: number,
  restore: Restore,
  chunkBytes: number
): SQL[] {
  const version = sql`(SELECT ${users.active_version} FROM ${users} WHERE ${users.id} = ${userId})`;
  const madeEntries = sql`(
    SELECT ${textEntries.id} AS id, ROW_NUMBER() OVER (ORDER BY ${textEntries.id}) - 1 AS k
    FROM ${textEntries}
    WHERE ${textEntries.user_id} = ${userId} AND ${textEntries.version} = ${version}
  )`;
  return [
    ...chunked(restore.tags, chunkBytes).map(
      run => sql`INSERT INTO ${tags} (
          "name", "user_id", "version", "order", "is_public", "is_deleted",
          "date_created", "date_updated", "date_last_used"
        )
        SELECT ${field('name')}, ${userId}, ${version}, ${field('order')},
          ${field('is_public')}, 0, ${field('date_created')},
          ${nextRevision(tagResource, userId)}, ${field('date_created')}
        FROM json_each(${JSON.stringify(run)})
        ORDER BY key`
    ),
    ...chunked(restore.entries, chunkBytes).map(
      run => sql`INSERT INTO ${textEntries} (
          "subject", "body", "subject_folded", "body_folded", "user_id",
          "version", "is_public", "is_deleted", "date_created", "date_updated"
        )
        SELECT ${field('subject')}, ${field('body')},
          ${field('subject_folded')}, ${field('body_folded')}, ${userId},
          ${version}, ${field('is_public')}, 0, ${field('date_created')},
          ${nextRevision(textEntryResource, userId)}
        FROM json_each(${JSON.stringify(run)})
        ORDER BY key`
    ),
    ...chunked(restore.taggings, chunkBytes).map(run => {
      const value = sql`j.value`;
      return sql`INSERT INTO ${tagsEntries} (
          "tag_id", "text_entry_id", "user_id", "version", "order",
          "is_deleted", "date_created", "date_updated"
        )
        SELECT t."id", e.id, ${userId}, ${version}, ${field('order', value)},
          0, ${field('date_created', value)},
          ${nextRevision(tagTextEntryResource, userId)}
        FROM json_each(${JSON.stringify(run)}) AS j
        JOIN ${tags} AS t
          ON t."user_id" = ${userId} AND t."version" = ${version}
          AND t."name" = ${field('tag_name', value)}
        JOIN ${madeEntries} AS e ON e.k = ${field('entry_index', value)}
        ORDER BY j.key`;
    }),
    ...chunked(restore.reuses, chunkBytes).map(run => {
      const value = sql`r.value`;
      return sql`INSERT INTO ${entryReuses} ("text_entry_id", "user_id", "version", "date_created")
        SELECT e.id, ${userId}, ${version}, ${field('date_created', value)}
        FROM json_each(${JSON.stringify(run)}) AS r
        JOIN ${madeEntries} AS e ON e.k = ${field('entry_index', value)}
        ORDER BY r.key`;
    }),
    // The taggings were made by tag, not by date: date each tag by its
    // newest (by when it was made, with none).
    sql`UPDATE ${tags} SET "date_last_used" = COALESCE(
        (SELECT MAX(j."date_created") FROM ${tagsEntries} AS j
          WHERE j."tag_id" = ${tags}."id" AND j."is_deleted" = 0),
        "date_created"
      )
      WHERE "user_id" = ${userId} AND "version" = ${version}`,
  ];
}

/**
 * Only over data version `over`: unless it is the active one, the active
 * version's row is made again, which its primary key refuses (the active
 * version always has one), so the batch, all of the restore, is undone.
 * Checked in the batch itself, so a restore or a switch that commits after
 * the request's own check (`versionOf`) stops it too.
 */
const overGuard = (userId: number, over: number) =>
  sql`INSERT INTO ${dataVersions} ("user_id", "version", "date_created", "origin")
    SELECT ${users.id}, ${users.active_version}, ${now()}, 'restore'
    FROM ${users}
    WHERE ${users.id} = ${userId} AND ${users.active_version} <> ${over}`;

/** How a restore runs. */
interface RestoreOptions {
  /** The most JSON one statement binds (`CHUNK_BYTES`). */
  chunkBytes?: number;
  /** The data version it must be made over (the one the request names). */
  over?: number;
}

/**
 * Make `restore`'s rows `userId`'s data as a new data version, active, in
 * one batch: one transaction, so a failure anywhere in it undoes all of it.
 * Returns its number; 409 `data_version_changed` when `over` is not the
 * active version by the time the batch runs.
 */
export async function restoreInto(
  db: Db,
  userId: number,
  restore: Restore,
  {chunkBytes = CHUNK_BYTES, over}: RestoreOptions = {}
): Promise<number> {
  const statements = [
    ...(over === undefined ? [] : [overGuard(userId, over)]),
    ...versionStatements(db, userId, restore),
    ...rowInserts(userId, restore, chunkBytes),
    sql`SELECT ${users.active_version} AS version FROM ${users} WHERE ${users.id} = ${userId}`,
  ];
  let results: D1Result<{version: number}>[];
  try {
    results = await rawBatch<{version: number}>(db, statements);
  } catch (error) {
    if (isVersionClash(error)) {
      throw dataVersionChanged();
    }
    throw error;
  }
  const version = results.at(-1)?.results[0]?.version;
  if (version === undefined) {
    throw new Error(`restore into user ${userId} made no version`);
  }
  return version;
}

restoreRoutes.post('/', async c => {
  const user = requireUser(c);
  // Only over the version the client's copy is of (the one it warned
  // about): another device's restore or switch since is a 409, checked now
  // and again in the batch.
  const over = versionOf(c, user);
  const restore = prepareRestore(
    parsed(backupSchema, await readJson(c.req.raw, false))
  );
  const version = await restoreInto(c.get('db'), user.id, restore, {over});
  const result: RestoreResult = {
    data_version: version,
    tags: restore.tags.length,
    entries: restore.entries.length,
    tags_entries: restore.taggings.length,
    entry_reuses: restore.reuses.length,
  };
  return c.json(result, 200, {'Cache-Control': 'no-store'});
});
