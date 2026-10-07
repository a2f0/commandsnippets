/**
 * `POST /api/v1/user/restore`: replace all of the requester's data with a
 * backup (api-shared's `backupSchema`), whoever's it is, so data can move
 * between accounts. Every tag, entry and tagging the user has is deleted,
 * and the backup's are made anew, with ids of their own, in one D1 batch:
 * one transaction, so all of it happens or none of it.
 *
 * Deletes are soft, as everywhere: each row deleted advances its revision,
 * so every device's sync takes it out, as it takes in the rows made. A tag
 * whose name the user has (deleted or not) is brought back in place, since
 * names are unique per user. Rows keep the backup's `date_created`. Tags
 * rank after every tag the user has (deleted tags keep their ranks), in the
 * backup's order, and taggings after their tag's, in theirs. Every row
 * written counts as a client write made now (`client_updated`), so a write
 * queued before the restore on another device changes nothing.
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
import {entryReuses, tags, tagsEntries, textEntries} from '../db/schema';
import type {AppEnv} from '../env';
import {ApiError, parseError} from '../lib/errors';
import {assertJsonMediaType} from '../lib/jsonapi';
import {searchColumns} from '../lib/search';
import {clientUpdated} from './lww';
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
  date_created: string;
}

interface ReuseRow {
  entry_index: number;
  date_created: string;
}

export interface Restore {
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
    .map(({row, index}) => {
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
    tags: tagRows,
    entries: entryRows,
    taggings: taggingRows,
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

/** `rows` with each one's place in its run (`rank`), by `group`. */
function ranked<T>(rows: readonly T[], group: (row: T) => string) {
  const next = new Map<string, number>();
  return rows.map(row => {
    const key = group(row);
    const rank = next.get(key) ?? 0;
    next.set(key, rank + 1);
    return {...row, rank};
  });
}

const field = (name: string, from: SQL = sql`value`) =>
  sql`json_extract(${from}, ${`$.${name}`})`;

/**
 * The statements of a restore into `userId`'s account, in order. The live
 * entries, once the old ones are deleted, are exactly the ones made, in the
 * order made: their row numbers are the backup's entry indexes.
 */
function restoreStatements(
  db: Db,
  userId: number,
  at: string,
  restore: Restore,
  chunkBytes: number
): SQL[] {
  const madeEntries = sql`(
    SELECT ${textEntries.id} AS id, ROW_NUMBER() OVER (ORDER BY ${textEntries.id}) - 1 AS k
    FROM ${textEntries}
    WHERE ${textEntries.user_id} = ${userId} AND ${textEntries.is_deleted} = 0
  )`;
  const deleted = {is_deleted: true, client_updated: at} as const;
  return [
    // Taggings first: the entries' deletes then advance no tagging.
    db
      .update(tagsEntries)
      .set({
        ...deleted,
        date_updated: nextRevision(tagTextEntryResource, userId),
      })
      .where(
        sql`${tagsEntries.user_id} = ${userId} AND ${tagsEntries.is_deleted} = 0`
      )
      .getSQL(),
    db
      .update(textEntries)
      .set({...deleted, date_updated: nextRevision(textEntryResource, userId)})
      .where(
        sql`${textEntries.user_id} = ${userId} AND ${textEntries.is_deleted} = 0`
      )
      .getSQL(),
    db
      .update(tags)
      .set({...deleted, date_updated: nextRevision(tagResource, userId)})
      .where(sql`${tags.user_id} = ${userId} AND ${tags.is_deleted} = 0`)
      .getSQL(),
    // Ranked after every tag the user has, as read before each run (the
    // statement reads the table it writes, so SQLite reads it all first).
    ...chunked(restore.tags, chunkBytes).map(
      run =>
        sql`INSERT INTO ${tags} (
          "name", "user_id", "order", "is_public", "is_deleted",
          "date_created", "date_updated", "date_last_used", "client_updated"
        )
        SELECT ${field('name')}, ${userId},
          (SELECT COALESCE(MAX("order"), -1) + 1 FROM ${tags} WHERE "user_id" = ${userId}) + ${field('rank')},
          ${field('is_public')}, 0, ${field('date_created')},
          ${nextRevision(tagResource, userId)}, ${field('date_created')}, ${at}
        FROM json_each(${JSON.stringify(ranked(run, () => ''))})
        WHERE true
        ORDER BY key
        ON CONFLICT ("name", "user_id") DO UPDATE SET
          "order" = excluded."order",
          "is_public" = excluded."is_public",
          "is_deleted" = 0,
          "date_created" = excluded."date_created",
          "date_updated" = excluded."date_updated",
          "date_last_used" = excluded."date_last_used",
          "client_updated" = excluded."client_updated"`
    ),
    ...chunked(restore.entries, chunkBytes).map(
      run =>
        sql`INSERT INTO ${textEntries} (
          "subject", "body", "subject_folded", "body_folded", "user_id",
          "is_public", "is_deleted", "date_created", "date_updated",
          "client_updated"
        )
        SELECT ${field('subject')}, ${field('body')},
          ${field('subject_folded')}, ${field('body_folded')}, ${userId},
          ${field('is_public')}, 0, ${field('date_created')},
          ${nextRevision(textEntryResource, userId)}, ${at}
        FROM json_each(${JSON.stringify(run)})
        ORDER BY key`
    ),
    // Each tag's taggings after its old ones' ranks, in the backup's order.
    ...chunked(restore.taggings, chunkBytes).map(run => {
      const value = sql`j.value`;
      return sql`INSERT INTO ${tagsEntries} (
          "tag_id", "text_entry_id", "user_id", "order", "is_deleted",
          "date_created", "date_updated", "client_updated"
        )
        SELECT t."id", e.id, ${userId},
          (SELECT COALESCE(MAX(o."order"), -1) + 1 FROM ${tagsEntries} AS o WHERE o."tag_id" = t."id") + ${field('rank', value)},
          0, ${field('date_created', value)},
          ${nextRevision(tagTextEntryResource, userId)}, ${at}
        FROM json_each(${JSON.stringify(ranked(run, row => row.tag_name))}) AS j
        JOIN ${tags} AS t
          ON t."user_id" = ${userId} AND t."is_deleted" = 0
          AND t."name" = ${field('tag_name', value)}
        JOIN ${madeEntries} AS e ON e.k = ${field('entry_index', value)}
        ORDER BY j.key`;
    }),
    ...chunked(restore.reuses, chunkBytes).map(run => {
      const value = sql`r.value`;
      return sql`INSERT INTO ${entryReuses} ("text_entry_id", "user_id", "date_created")
        SELECT e.id, ${userId}, ${field('date_created', value)}
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
      WHERE "user_id" = ${userId} AND "is_deleted" = 0`,
  ];
}

/**
 * Replace `userId`'s data with `restore`'s rows, writing as a client write
 * made at `at`, in one batch (runs of at most `chunkBytes` of JSON each).
 */
export async function restoreInto(
  db: Db,
  userId: number,
  at: string,
  restore: Restore,
  chunkBytes = CHUNK_BYTES
): Promise<void> {
  // Drizzle (0.45) cannot batch raw statements with parameters, so they are
  // prepared on the D1 binding.
  const d1 = db.$client;
  await d1.batch(
    restoreStatements(db, userId, at, restore, chunkBytes).map(statement => {
      const query = dialect.sqlToQuery(statement);
      return d1.prepare(query.sql).bind(...query.params);
    })
  );
}

restoreRoutes.post('/', async c => {
  const user = requireUser(c);
  const restore = prepareRestore(await readBackup(c.req.raw));
  await restoreInto(c.get('db'), user.id, await clientUpdated(c), restore);
  const result: RestoreResult = {
    tags: restore.tags.length,
    entries: restore.entries.length,
    tags_entries: restore.taggings.length,
    entry_reuses: restore.reuses.length,
  };
  return c.json(result, 200, {'Cache-Control': 'no-store'});
});
