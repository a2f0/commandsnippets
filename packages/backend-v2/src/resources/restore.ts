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
import {
  type Backup,
  backupSchema,
  CODES,
  errorMeta,
  MESSAGES,
  parseDateTime,
  type RestoreResult,
  tagCreateAttributesSchema,
  textEntryCreateAttributesSchema,
} from '@commandsnippets/api-shared';
import {type SQL, sql} from 'drizzle-orm';
import {SQLiteAsyncDialect} from 'drizzle-orm/sqlite-core';
import {Hono} from 'hono';
import * as z from 'zod/mini';
import {requireUser} from '../auth/permissions';
import type {Db} from '../db/client';
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
import {ApiError, dataVersionChanged, parseError} from '../lib/errors';
import {assertJsonMediaType} from '../lib/jsonapi';
import {searchColumns} from '../lib/search';
import {versionOf} from './dataVersions';
import {
  nextRevision,
  tagResource,
  tagTextEntryResource,
  textEntryResource,
} from './owned';

export const restoreRoutes = new Hono<AppEnv>();

const dialect = new SQLiteAsyncDialect();

/**
 * The most JSON one statement binds: D1 caps a bound value at 2 MB, so the
 * rows go in runs of at most this many bytes.
 */
export const CHUNK_BYTES = 1_000_000;

const tagFields = z.pick(tagCreateAttributesSchema, {name: true});
const entryFields = z.pick(textEntryCreateAttributesSchema, {
  subject: true,
  body: true,
});

/** A 400 naming where in the backup it is invalid. */
function invalid(
  path: readonly PropertyKey[],
  message: string,
  code: string = CODES.invalid
): ApiError {
  const pointer = `/${path.map(String).join('/')}`;
  return ApiError.of(
    400,
    `Invalid backup at ${pointer}: ${message}`,
    code,
    pointer
  );
}

/** `input` parsed with `schema`, or a 400 at its first issue under `path`. */
function parsed<S extends z.ZodMiniType>(
  schema: S,
  input: unknown,
  path: readonly PropertyKey[] = []
): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  const [issue] = result.error.issues as [z.core.$ZodIssue];
  throw invalid([...path, ...issue.path], issue.message, errorMeta(issue).code);
}

/** A backup timestamp in the stored, fixed-width form. */
function stored(value: string, path: readonly PropertyKey[]): string {
  const timestamp = parseDateTime(value);
  if (timestamp === null) {
    throw invalid(path, 'Not a valid date and time.');
  }
  return timestamp;
}

async function readBackup(request: Request): Promise<Backup> {
  assertJsonMediaType(request);
  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch (error) {
    throw parseError(MESSAGES.jsonParseError((error as Error).message));
  }
  return parsed(backupSchema, body);
}

interface TagRow {
  name: string;
  /** Its rank: its place in the backup's order. */
  order: number;
  is_public: boolean;
  date_created: string;
}

interface EntryRow {
  subject: string;
  body: string;
  subject_folded: string;
  body_folded: string;
  is_public: boolean;
  date_created: string;
}

interface TaggingRow {
  tag_name: string;
  /** The entry's place in the backup's entries (and so among those made). */
  entry_index: number;
  /** Its rank: its place in its tag's order in the backup. */
  order: number;
  date_created: string;
}

interface ReuseRow {
  entry_index: number;
  date_created: string;
}

export interface Restore {
  /** The backup's: whose data it was, and when it was exported. */
  source: {username: string; exported: string};
  /** In the backup's order. */
  tags: TagRow[];
  entries: EntryRow[];
  /** By tag, each tag's in its order. */
  taggings: TaggingRow[];
  /** Oldest first: the last made sets the entry's `reused_date`. */
  reuses: ReuseRow[];
}

/** Fixed-width timestamps compare as strings. */
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** By `order`, then place in the backup. */
const byOrder = <T extends {order: number}>(
  a: {row: T; index: number},
  b: {row: T; index: number}
) => a.row.order - b.row.order || a.index - b.index;

/**
 * The rows to make, checked as the API checks a create of each (a tag's
 * name, an entry's subject and body), with every reference resolved within
 * the backup: a 400 at the first problem.
 */
export function prepareRestore(backup: Backup): Restore {
  const tagNames = new Map<string, string>();
  const names = new Set<string>();
  const tagRows = backup.tags
    .map((row, index) => ({row, index}))
    .sort(byOrder)
    .map(({row, index}, order) => {
      const path = ['tags', index];
      const {name} = parsed(tagFields, {name: row.name}, path);
      if (tagNames.has(row.id)) {
        throw invalid([...path, 'id'], `Another tag has the id ${row.id}.`);
      }
      if (names.has(name)) {
        throw invalid(
          [...path, 'name'],
          `Another tag is named "${name}".`,
          CODES.unique
        );
      }
      tagNames.set(row.id, name);
      names.add(name);
      return {
        name,
        order,
        is_public: row.is_public,
        date_created: stored(row.date_created, [...path, 'date_created']),
      };
    });

  const entryIndexes = new Map<string, number>();
  const entryRows = backup.entries.map((row, index) => {
    const path = ['entries', index];
    const fields = parsed(
      entryFields,
      {subject: row.subject, body: row.body},
      path
    );
    if (entryIndexes.has(row.id)) {
      throw invalid([...path, 'id'], `Another entry has the id ${row.id}.`);
    }
    entryIndexes.set(row.id, index);
    return {
      ...fields,
      ...searchColumns(fields),
      is_public: row.is_public,
      date_created: stored(row.date_created, [...path, 'date_created']),
    };
  });

  const entryOf = (id: string, path: PropertyKey[]): number => {
    const index = entryIndexes.get(id);
    if (index === undefined) {
      throw invalid(path, `No entry in the backup has the id ${id}.`);
    }
    return index;
  };

  const pairs = new Set<string>();
  const taggingRows = backup.tags_entries
    .map((row, index) => {
      const path = ['tags_entries', index];
      const tagName = tagNames.get(row.tag_id);
      if (tagName === undefined) {
        throw invalid(
          [...path, 'tag_id'],
          `No tag in the backup has the id ${row.tag_id}.`
        );
      }
      const entryIndex = entryOf(row.text_entry_id, [...path, 'text_entry_id']);
      const pair = `${row.tag_id},${row.text_entry_id}`;
      if (pairs.has(pair)) {
        throw invalid(path, 'Another tagging has the same tag and entry.');
      }
      pairs.add(pair);
      return {
        row,
        index,
        tagging: {
          tag_name: tagName,
          entry_index: entryIndex,
          date_created: stored(row.date_created, [...path, 'date_created']),
        },
      };
    })
    .sort(
      (a, b) =>
        Number(a.row.tag_id) - Number(b.row.tag_id) ||
        a.row.order - b.row.order ||
        a.index - b.index
    )
    .map(({tagging}) => tagging);
  const ranks = new Map<string, number>();
  const rankedTaggings = taggingRows.map(tagging => {
    const order = ranks.get(tagging.tag_name) ?? 0;
    ranks.set(tagging.tag_name, order + 1);
    return {...tagging, order};
  });

  const reuseRows = backup.entry_reuses
    .map((row, index) => {
      const path = ['entry_reuses', index];
      return {
        index,
        reuse: {
          entry_index: entryOf(row.text_entry_id, [...path, 'text_entry_id']),
          date_created: stored(row.date_created, [...path, 'date_created']),
        },
      };
    })
    .sort(
      (a, b) =>
        compare(a.reuse.date_created, b.reuse.date_created) || a.index - b.index
    )
    .map(({reuse}) => reuse);

  return {
    source: {
      username: backup.user.username,
      exported: stored(backup.date_exported, ['date_exported']),
    },
    tags: tagRows,
    entries: entryRows,
    taggings: rankedTaggings,
    reuses: reuseRows,
  };
}

/** `rows` in runs whose JSON stays under `maxBytes`, in order. */
export function chunked<T>(rows: readonly T[], maxBytes = CHUNK_BYTES): T[][] {
  const encoder = new TextEncoder();
  const chunks: T[][] = [];
  let chunk: T[] = [];
  let size = 2;
  for (const row of rows) {
    const rowSize = encoder.encode(JSON.stringify(row)).length + 1;
    if (chunk.length > 0 && size + rowSize > maxBytes) {
      chunks.push(chunk);
      chunk = [];
      size = 2;
    }
    chunk.push(row);
    size += rowSize;
  }
  if (chunk.length > 0) {
    chunks.push(chunk);
  }
  return chunks;
}

const field = (name: string, from: SQL = sql`value`) =>
  sql`json_extract(${from}, ${`$.${name}`})`;

/**
 * The statements of a restore into `userId`'s account, in order. The new
 * version is numbered (one past the last given out), recorded and made
 * active first, so the rows written next are of the active version, as the
 * data version triggers require. Its entries, all made here, in order, have
 * the backup's entry indexes as their row numbers.
 */
function restoreStatements(
  db: Db,
  userId: number,
  restore: Restore,
  chunkBytes: number
): SQL[] {
  const user = sql`${users.id} = ${userId}`;
  const version = sql`(SELECT ${users.active_version} FROM ${users} WHERE ${user})`;
  const madeEntries = sql`(
    SELECT ${textEntries.id} AS id, ROW_NUMBER() OVER (ORDER BY ${textEntries.id}) - 1 AS k
    FROM ${textEntries}
    WHERE ${textEntries.user_id} = ${userId} AND ${textEntries.version} = ${version}
  )`;
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
export interface RestoreOptions {
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
    ...restoreStatements(db, userId, restore, chunkBytes),
    sql`SELECT ${users.active_version} AS version FROM ${users} WHERE ${users.id} = ${userId}`,
  ];
  // Drizzle (0.45) cannot batch raw statements with parameters, so they are
  // prepared on the D1 binding.
  const d1 = db.$client;
  let results: D1Result<{version: number}>[];
  try {
    results = await d1.batch<{version: number}>(
      statements.map(statement => {
        const query = dialect.sqlToQuery(statement);
        return d1.prepare(query.sql).bind(...query.params);
      })
    );
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
  const restore = prepareRestore(await readBackup(c.req.raw));
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
