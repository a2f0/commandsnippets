/**
 * Last writer wins, by when a write was made: clients queue their writes
 * (offline too) and send them later, naming when each was made
 * (api-shared's CLIENT_UPDATED_HEADER). A write to a tag, entry or junction
 * applies only when it is no older than the row's last client write
 * (`client_updated`); an older one changes nothing, and its response is the
 * row as it stands, which the client then keeps. Reorders are not guarded:
 * they apply in the order they arrive.
 */
import {CLIENT_UPDATED_HEADER} from '@commandsnippets/api-shared';
import {type SQL, sql} from 'drizzle-orm';
import type {SQLiteColumn} from 'drizzle-orm/sqlite-core';
import type {Context} from 'hono';
import type {AppEnv} from '../env';
import {now, parseDateTime} from '../lib/clock';
import {validationError} from '../lib/errors';

/**
 * When the request's write was made: the header's time, but never later than
 * now (a device whose clock runs ahead cannot win every later write), or now
 * when the request names none. A malformed time is a 400.
 */
export function clientUpdated(c: Context<AppEnv>): string {
  const current = now();
  const header = c.req.header(CLIENT_UPDATED_HEADER);
  if (header === undefined) {
    return current;
  }
  const at = parseDateTime(header);
  if (at === null) {
    throw validationError(`${CLIENT_UPDATED_HEADER} is not a datetime.`);
  }
  return at < current ? at : current;
}

/** A write made at `at` applies: the row's last client write is no newer. */
export const writtenBefore = (column: SQLiteColumn, at: string): SQL =>
  sql`(${column} IS NULL OR ${column} <= ${at})`;

/** Whether a write made at `at` applies to a row last written at `last`. */
export const appliesAfter = (last: string | null, at: string): boolean =>
  last === null || last <= at;
