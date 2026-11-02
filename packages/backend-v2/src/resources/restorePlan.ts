/**
 * What a restore makes (`restore.ts`): a backup's rows checked as the API
 * checks a create of each (a tag's name, an entry's subject and body), with
 * every reference resolved within the backup, in the order they are made.
 */
import {
  type Backup,
  CODES,
  errorMeta,
  parseDateTime,
  tagCreateAttributesSchema,
  textEntryCreateAttributesSchema,
} from '@commandsnippets/api-shared';
import * as z from 'zod/mini';
import {ApiError} from '../lib/errors';
import {searchColumns} from '../lib/search';

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
export function parsed<S extends z.ZodMiniType>(
  schema: S,
  input: unknown,
  path: readonly PropertyKey[] = []
): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  const [issue] = result.error.issues;
  if (issue === undefined) {
    throw invalid(path, 'Invalid input.');
  }
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
  /** Oldest first, as they were made. */
  reuses: ReuseRow[];
}

/** Fixed-width timestamps compare as strings. */
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** By `order`, then place in the backup. */
const byOrder = <T extends {order: number}>(
  a: {row: T; index: number},
  b: {row: T; index: number}
) => a.row.order - b.row.order || a.index - b.index;

/** The tags in the backup's order, and each one's name by its backup id. */
function planTags(backup: Backup): {
  rows: TagRow[];
  names: Map<string, string>;
} {
  const names = new Map<string, string>();
  const taken = new Set<string>();
  const rows = backup.tags
    .map((row, index) => ({row, index}))
    .sort(byOrder)
    .map(({row, index}, order) => {
      const path = ['tags', index];
      const {name} = parsed(tagFields, {name: row.name}, path);
      if (names.has(row.id)) {
        throw invalid([...path, 'id'], `Another tag has the id ${row.id}.`);
      }
      if (taken.has(name)) {
        throw invalid(
          [...path, 'name'],
          `Another tag is named "${name}".`,
          CODES.unique
        );
      }
      names.set(row.id, name);
      taken.add(name);
      return {
        name,
        order,
        is_public: row.is_public,
        date_created: stored(row.date_created, [...path, 'date_created']),
      };
    });
  return {rows, names};
}

/** The entries, and a lookup of each one's place by its backup id. */
function planEntries(backup: Backup): {
  rows: EntryRow[];
  indexOf: (id: string, path: PropertyKey[]) => number;
} {
  const indexes = new Map<string, number>();
  const rows = backup.entries.map((row, index) => {
    const path = ['entries', index];
    const fields = parsed(
      entryFields,
      {subject: row.subject, body: row.body},
      path
    );
    if (indexes.has(row.id)) {
      throw invalid([...path, 'id'], `Another entry has the id ${row.id}.`);
    }
    indexes.set(row.id, index);
    return {
      ...fields,
      ...searchColumns(fields),
      is_public: row.is_public,
      date_created: stored(row.date_created, [...path, 'date_created']),
    };
  });
  const indexOf = (id: string, path: PropertyKey[]): number => {
    const index = indexes.get(id);
    if (index === undefined) {
      throw invalid(path, `No entry in the backup has the id ${id}.`);
    }
    return index;
  };
  return {rows, indexOf};
}

/** The taggings by tag, each ranked by its place in its tag's order. */
function planTaggings(
  backup: Backup,
  tagNames: Map<string, string>,
  entryIndex: (id: string, path: PropertyKey[]) => number
): TaggingRow[] {
  const pairs = new Set<string>();
  const ranks = new Map<string, number>();
  return backup.tags_entries
    .map((row, index) => {
      const path = ['tags_entries', index];
      const tagName = tagNames.get(row.tag_id);
      if (tagName === undefined) {
        throw invalid(
          [...path, 'tag_id'],
          `No tag in the backup has the id ${row.tag_id}.`
        );
      }
      const entry = entryIndex(row.text_entry_id, [...path, 'text_entry_id']);
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
          entry_index: entry,
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
    .map(({tagging}) => {
      const order = ranks.get(tagging.tag_name) ?? 0;
      ranks.set(tagging.tag_name, order + 1);
      return {...tagging, order};
    });
}

/** The reuses, oldest first. */
function planReuses(
  backup: Backup,
  entryIndex: (id: string, path: PropertyKey[]) => number
): ReuseRow[] {
  return backup.entry_reuses
    .map((row, index) => {
      const path = ['entry_reuses', index];
      return {
        index,
        reuse: {
          entry_index: entryIndex(row.text_entry_id, [
            ...path,
            'text_entry_id',
          ]),
          date_created: stored(row.date_created, [...path, 'date_created']),
        },
      };
    })
    .sort(
      (a, b) =>
        compare(a.reuse.date_created, b.reuse.date_created) || a.index - b.index
    )
    .map(({reuse}) => reuse);
}

/** The rows to make (see the module comment): a 400 at the first problem. */
export function prepareRestore(backup: Backup): Restore {
  const tags = planTags(backup);
  const entries = planEntries(backup);
  const taggings = planTaggings(backup, tags.names, entries.indexOf);
  const reuses = planReuses(backup, entries.indexOf);
  return {
    source: {
      username: backup.user.username,
      exported: stored(backup.date_exported, ['date_exported']),
    },
    tags: tags.rows,
    entries: entries.rows,
    taggings,
    reuses,
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
