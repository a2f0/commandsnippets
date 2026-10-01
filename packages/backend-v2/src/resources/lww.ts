/**
 * Last writer wins, by when a write was made: clients queue their writes
 * (offline too) and send them later, naming when each was made
 * (api-shared's CLIENT_UPDATED_HEADER) and naming each
 * (CLIENT_WRITE_ID_HEADER). A write to a tag, entry or junction
 * applies only when it is no older than the row's last client write
 * (`client_updated`); an older one changes nothing, and its response is the
 * row as it stands, which the client then keeps. Reorders are not guarded:
 * they apply in the order they arrive.
 */
import {
  CLIENT_UPDATED_HEADER,
  CLIENT_WRITE_ID_HEADER,
  CLIENT_WRITE_ID_MAX_LENGTH,
  CODES,
} from '@commandsnippets/api-shared';
import {and, eq, lt, type SQL, sql} from 'drizzle-orm';
import type {SQLiteColumn} from 'drizzle-orm/sqlite-core';
import type {Context} from 'hono';
import {requireUser} from '../auth/permissions';
import {clientWrites} from '../db/schema';
import type {AppEnv} from '../env';
import {formatMicros, now, nowMicros, parseDateTime} from '../lib/clock';
import {ApiError, validationError} from '../lib/errors';

/** How long the API remembers when a write it counted as now was made. */
const CLIENT_WRITES_KEPT_MICROS = 30 * 24 * 60 * 60 * 1_000_000;

/**
 * When the request's write was made: the header's time, but never later than
 * now (a device whose clock runs ahead cannot win every later write), or now
 * when the request names none. A write named by `CLIENT_WRITE_ID_HEADER`
 * that counted as now (named no time, or one ahead of the clock) counts as
 * made when it first arrived on every attempt, so a retry after a lost
 * answer never beats a write made in between. A malformed time or write id
 * is a 400.
 */
export async function clientUpdated(c: Context<AppEnv>): Promise<string> {
  const current = now();
  const header = c.req.header(CLIENT_UPDATED_HEADER);
  const at = header === undefined ? null : parseDateTime(header);
  if (header !== undefined && at === null) {
    throw validationError(`${CLIENT_UPDATED_HEADER} is not a datetime.`);
  }
  const writeId = c.req.header(CLIENT_WRITE_ID_HEADER);
  if (writeId === undefined) {
    return at !== null && at < current ? at : current;
  }
  if (writeId === '' || writeId.length > CLIENT_WRITE_ID_MAX_LENGTH) {
    throw validationError(
      `${CLIENT_WRITE_ID_HEADER} must have 1 to ${CLIENT_WRITE_ID_MAX_LENGTH} characters.`
    );
  }
  const user = requireUser(c);
  const db = c.get('db');
  const counted = async () =>
    (
      await db
        .select({made: clientWrites.made})
        .from(clientWrites)
        .where(
          and(
            eq(clientWrites.user_id, user.id),
            eq(clientWrites.write_id, writeId)
          )
        )
        .limit(1)
    )[0]?.made;
  const earlier = await counted();
  if (earlier !== undefined) {
    return earlier;
  }
  // Made in the past: the same time on every attempt.
  if (at !== null && at <= current) {
    return at;
  }
  // Counted as now, which its retries count too.
  await db.batch([
    db
      .delete(clientWrites)
      .where(
        lt(
          clientWrites.date_created,
          formatMicros(nowMicros() - CLIENT_WRITES_KEPT_MICROS)
        )
      ),
    db
      .insert(clientWrites)
      .values({
        user_id: user.id,
        write_id: writeId,
        made: current,
        date_created: current,
      })
      .onConflictDoNothing(),
  ]);
  return (await counted()) ?? current;
}

/** A write made at `at` applies: the row's last client write is no newer. */
export const writtenBefore = (column: SQLiteColumn, at: string): SQL =>
  sql`(${column} IS NULL OR ${column} <= ${at})`;

/** Whether a write made at `at` applies to a row last written at `last`. */
export const appliesAfter = (last: string | null, at: string): boolean =>
  last === null || last <= at;

/**
 * How many times a write to a row it read reads it again, when another write
 * changed it in between (a compare and set: each write applies only to the
 * row as read).
 */
export const WRITE_ATTEMPTS = 3;

/** A 409 to retry: the row kept changing while the write was made. */
export const changedMeanwhile = (what: string): ApiError =>
  ApiError.of(
    409,
    `The ${what} changed while it was being written. Please retry.`,
    CODES.orderingConflict
  );
