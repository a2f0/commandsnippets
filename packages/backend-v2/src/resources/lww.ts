/**
 * Last writer wins, by when a write was made: clients queue their writes
 * (offline too) and send them later, naming when each was made
 * (api-shared's CLIENT_UPDATED_HEADER) and naming each
 * (CLIENT_WRITE_ID_HEADER). A write to a tag, entry or junction
 * applies only when it is no older than the row's last client write
 * (`client_updated`); an older one changes nothing, and its response is the
 * row as it stands, which the client then keeps. Times are the clients'
 * (never later than now), or now, by the API's write clock (`tick`), on
 * which no two writes share a time. Reorders are not guarded: they apply in
 * the order they arrive.
 */
import {
  CLIENT_UPDATED_HEADER,
  CLIENT_WRITE_ID_HEADER,
  CLIENT_WRITE_ID_MAX_LENGTH,
  CODES,
} from '@commandsnippets/api-shared';
import {and, eq, type SQL, sql} from 'drizzle-orm';
import type {SQLiteColumn} from 'drizzle-orm/sqlite-core';
import type {Context} from 'hono';
import {requireUser} from '../auth/permissions';
import type {Db} from '../db/client';
import {clientWrites} from '../db/schema';
import type {AppEnv} from '../env';
import {formatMicros, now, parseDateTime} from '../lib/clock';
import {ApiError, validationError} from '../lib/errors';

/**
 * Now by the API's write clock (`sync_clock`): the database's clock, which
 * every isolate shares (so none whose clock runs a little ahead of another's
 * makes a later write older), advanced by at least a microsecond at each
 * call, so no two writes share a time (D1 runs one statement at a time).
 */
async function tick(db: Db): Promise<string> {
  const row = await db.get<{micros: number}>(
    sql`INSERT INTO sync_clock (id, micros)
      VALUES (1, CAST((julianday('now') - 2440587.5) * 86400000000 AS INTEGER))
      ON CONFLICT (id) DO UPDATE
      SET micros = MAX(excluded.micros, sync_clock.micros + 1)
      RETURNING micros`
  );
  return formatMicros(row.micros);
}

/**
 * When the request's write was made: the header's time, but never later than
 * now by the API's write clock (`tick`: a device whose clock runs ahead
 * cannot win every later write), or that now when the request names none.
 * A write named by `CLIENT_WRITE_ID_HEADER` counts as its first attempt was
 * counted on every later one (the API keeps that time as long as the user):
 * a retry after a lost answer, or after a failure, counts as the write did,
 * never beating a write made in between nor losing to one made before. Its
 * time is followed by its id (`<time>|<id>`), which orders two writes of the
 * same time. A malformed time or write id is a 400.
 */
export async function clientUpdated(c: Context<AppEnv>): Promise<string> {
  const header = c.req.header(CLIENT_UPDATED_HEADER);
  const at = header === undefined ? null : parseDateTime(header);
  if (header !== undefined && at === null) {
    throw validationError(`${CLIENT_UPDATED_HEADER} is not a datetime.`);
  }
  const writeId = c.req.header(CLIENT_WRITE_ID_HEADER);
  if (
    writeId !== undefined &&
    (writeId === '' || writeId.length > CLIENT_WRITE_ID_MAX_LENGTH)
  ) {
    throw validationError(
      `${CLIENT_WRITE_ID_HEADER} must have 1 to ${CLIENT_WRITE_ID_MAX_LENGTH} characters.`
    );
  }
  const db = c.get('db');
  const current = await tick(db);
  const counted = at !== null && at < current ? at : current;
  if (writeId === undefined) {
    return counted;
  }
  const user = requireUser(c);
  // The time its first attempt was counted at: this attempt's, when it is
  // the first.
  const [, [recorded]] = await db.batch([
    db
      .insert(clientWrites)
      .values({
        user_id: user.id,
        write_id: writeId,
        made: counted,
        date_created: now(),
      })
      .onConflictDoNothing(),
    db
      .select({made: clientWrites.made})
      .from(clientWrites)
      .where(
        and(
          eq(clientWrites.user_id, user.id),
          eq(clientWrites.write_id, writeId)
        )
      )
      .limit(1),
  ]);
  if (recorded === undefined) {
    throw new Error(`write ${writeId} was not recorded`);
  }
  // Two writes of the same time (from two devices) are ordered by their ids,
  // whichever arrives first: the time is fixed-width, so the two compare as
  // strings in that order, and a retry never wins a tie its write lost.
  return `${recorded.made}|${writeId}`;
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
