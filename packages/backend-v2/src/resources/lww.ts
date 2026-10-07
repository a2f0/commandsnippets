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
import {clientWrites, users} from '../db/schema';
import type {AppEnv} from '../env';
import {formatMicros, now, parseDateTime} from '../lib/clock';
import {ApiError, validationError} from '../lib/errors';

/**
 * Advance the API's write clock (`sync_clock`): the database's clock, which
 * every isolate shares (so none whose clock runs a little ahead of another's
 * makes a later write older), advanced by at least a microsecond at each
 * write, so no two writes share a time (D1 runs one statement at a time).
 */
const tick = sql`INSERT INTO sync_clock (id, micros)
  VALUES (1, CAST((julianday('now') - 2440587.5) * 86400000000 AS INTEGER))
  ON CONFLICT (id) DO UPDATE
  SET micros = MAX(excluded.micros, sync_clock.micros + 1)
  RETURNING micros`;

/** The write clock's time, in the API's fixed-width form. */
const clockTime = sql<string>`(SELECT strftime('%Y-%m-%dT%H:%M:%S', micros / 1000000, 'unixepoch') || '.' || printf('%06d', micros % 1000000) FROM sync_clock WHERE id = 1)`;

/** The id the request names its write by (`CLIENT_WRITE_ID_HEADER`), if any. */
export function clientWriteId(c: Context<AppEnv>): string | undefined {
  const writeId = c.req.header(CLIENT_WRITE_ID_HEADER);
  if (
    writeId !== undefined &&
    (writeId === '' || writeId.length > CLIENT_WRITE_ID_MAX_LENGTH)
  ) {
    throw validationError(
      `${CLIENT_WRITE_ID_HEADER} must have 1 to ${CLIENT_WRITE_ID_MAX_LENGTH} characters.`
    );
  }
  return writeId;
}

/**
 * Now by the API's write clock (`tick`), whatever the request says: for a
 * write made by the API itself (a restore), which no client's time decides.
 */
export async function writeClock(db: Db): Promise<string> {
  const {micros} = await db.get<{micros: number}>(tick);
  return formatMicros(micros);
}

/**
 * A 400 (`data_restored`) unless a client write made at `made` came after
 * the user's last restore (`date_restored`, read now): one made before it
 * (queued offline, say) would change what the restore replaced, or make
 * again what it deleted, so clients drop it. Made times are the clients',
 * as last writer wins compares them; a client that restores raises its own
 * past the restore's.
 */
async function assertMadeAfterRestore(
  c: Context<AppEnv>,
  made: string
): Promise<void> {
  const user = requireUser(c);
  const [row] = await c
    .get('db')
    .select({restored: users.date_restored})
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const restored = row?.restored ?? null;
  if (restored !== null && made < restored) {
    throw ApiError.of(
      400,
      'This write was made before the data was restored from a backup, which replaced it.',
      CODES.dataRestored
    );
  }
}

/**
 * The time a reorder names (`CLIENT_UPDATED_HEADER`), when it names one,
 * checked against the user's last restore (`assertMadeAfterRestore`).
 * Reorders are not otherwise guarded by when they were made.
 */
export async function assertReorderAfterRestore(
  c: Context<AppEnv>
): Promise<void> {
  const header = c.req.header(CLIENT_UPDATED_HEADER);
  const at = header === undefined ? null : parseDateTime(header);
  if (at !== null) {
    await assertMadeAfterRestore(c, at);
  }
}

/**
 * When the request's write was made: the header's time, but never later than
 * now by the API's write clock (`tick`: a device whose clock runs ahead
 * cannot win every later write), or that now when the request names none.
 * A write named by `CLIENT_WRITE_ID_HEADER` counts as its first attempt was
 * counted on every later one (the API keeps that time as long as the user),
 * which is recorded with the clock's tick, in one transaction: a retry after
 * a lost answer, or after a failure, or alongside the first attempt, counts
 * as the write did, never beating a write made in between nor losing to one
 * made before. Its time is followed by its id (`<time>|<id>`), which orders
 * two writes of the same time. A malformed time or write id is a 400, and so
 * is a write made before the user's last restore (`assertMadeAfterRestore`).
 */
export async function clientUpdated(c: Context<AppEnv>): Promise<string> {
  const header = c.req.header(CLIENT_UPDATED_HEADER);
  const at = header === undefined ? null : parseDateTime(header);
  if (header !== undefined && at === null) {
    throw validationError(`${CLIENT_UPDATED_HEADER} is not a datetime.`);
  }
  const writeId = clientWriteId(c);
  const db = c.get('db');
  if (writeId === undefined) {
    const current = await writeClock(db);
    const made = at !== null && at < current ? at : current;
    await assertMadeAfterRestore(c, made);
    return made;
  }
  const user = requireUser(c);
  const counted =
    at === null ? clockTime : sql<string>`MIN(${at}, ${clockTime})`;
  // The time its first attempt was counted at: this attempt's, when it is
  // the first.
  const [, , [recorded]] = await db.batch([
    db.run(tick),
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
  await assertMadeAfterRestore(c, recorded.made);
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
