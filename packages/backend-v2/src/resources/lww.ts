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
import {and, eq, type SQL, sql} from 'drizzle-orm';
import type {SQLiteColumn} from 'drizzle-orm/sqlite-core';
import type {Context} from 'hono';
import {requireUser} from '../auth/permissions';
import {clientWrites} from '../db/schema';
import type {AppEnv} from '../env';
import {formatMicros, now, parseDateTime} from '../lib/clock';
import {ApiError, validationError} from '../lib/errors';

/** When a write was made, as the API counts it. */
export interface Made {
  /** Its time. */
  at: string;
  /**
   * Counted as made now, on its first arrival (it named no time, or one
   * ahead of the API's clock): later than every write to the row before it,
   * whatever time another isolate's clock (which may run a little ahead)
   * gave theirs. So it applies to the row as it was read, whatever its time
   * (see `writtenBefore`), and leaves the later of the two times on it.
   */
  latest: boolean;
}

/**
 * When the request's write was made: the header's time, but never later than
 * now (a device whose clock runs ahead cannot win every later write), or now
 * when the request names none. A write named by `CLIENT_WRITE_ID_HEADER`
 * that counted as now (named no time, or one ahead of the clock) counts as
 * made when it first arrived on every later attempt, so a retry after a lost
 * answer never beats a write made in between: the API keeps that time for
 * as long as it keeps the user. A malformed time or write id is a 400.
 */
export async function clientUpdated(c: Context<AppEnv>): Promise<Made> {
  const current = now();
  const header = c.req.header(CLIENT_UPDATED_HEADER);
  const at = header === undefined ? null : parseDateTime(header);
  if (header !== undefined && at === null) {
    throw validationError(`${CLIENT_UPDATED_HEADER} is not a datetime.`);
  }
  const writeId = c.req.header(CLIENT_WRITE_ID_HEADER);
  if (writeId === undefined) {
    return at !== null && at < current
      ? {at, latest: false}
      : {at: current, latest: true};
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
    return {at: earlier, latest: false};
  }
  // Made in the past: the same time on every attempt.
  if (at !== null && at <= current) {
    return {at, latest: false};
  }
  // Counted as now, which its retries count too.
  await db
    .insert(clientWrites)
    .values({
      user_id: user.id,
      write_id: writeId,
      made: current,
      date_created: current,
    })
    .onConflictDoNothing();
  const first = await counted();
  // Another attempt of the write arrived first: this one is its retry.
  return first === undefined || first === current
    ? {at: current, latest: true}
    : {at: first, latest: false};
}

/**
 * The time a row's last client write had when this request first read the
 * row: a latest write applies over that one only (see `writtenBefore`).
 * Retries read the row again; the time a write committed since gave it does
 * not count.
 */
export class FirstReads {
  private readonly times = new Map<number, string | null>();

  of(row: {id: number; client_updated: string | null}): string | null {
    if (!this.times.has(row.id)) {
      this.times.set(row.id, row.client_updated);
    }
    return this.times.get(row.id) ?? null;
  }
}

/**
 * A write made at `made` applies: the row's last client write is no newer,
 * or, for the latest write, is still the one it first read (`read`). A
 * write committed since changes it (`stamped`), and then its time decides
 * as for any write: one made after this write arrived (while it was on its
 * way to the database) stands.
 */
export const writtenBefore = (
  column: SQLiteColumn,
  made: Made,
  read: string | null
): SQL => {
  const noNewer = sql`(${column} IS NULL OR ${column} <= ${made.at})`;
  if (!made.latest) {
    return noNewer;
  }
  return read === null
    ? sql`(${noNewer} OR ${column} IS NULL)`
    : sql`(${noNewer} OR ${column} = ${read})`;
};

/** Whether a write made at `made` applies to a row last written at `last`. */
export const appliesAfter = (
  last: string | null,
  made: Made,
  read: string | null
): boolean =>
  last === null || last <= made.at || (made.latest && last === read);

/** A microsecond after `time`. */
function justAfter(time: string): string {
  const fixed = parseDateTime(time) ?? time;
  const seconds = Date.parse(`${fixed.slice(0, 19)}Z`);
  return formatMicros(seconds * 1000 + Number(fixed.slice(20, 26)) + 1);
}

/**
 * The last client write time a write made at `made` leaves on the row it
 * changes: its own, or, for the latest write over a row it read stamped
 * later (by a clock ahead of this one's), a microsecond after that, so the
 * time never moves back and every write changes it (a concurrent latest
 * write that read the row before then no longer applies).
 */
export const stamped = (
  column: SQLiteColumn,
  made: Made,
  read: string | null
): string | SQL =>
  made.latest && read !== null && read > made.at
    ? sql`CASE WHEN ${column} IS NULL OR ${column} <= ${made.at} THEN ${made.at} ELSE ${justAfter(read)} END`
    : made.at;

/** `stamped`'s value on a row last written at `read`, as read. */
export const stampedAfter = (read: string | null, made: Made): string =>
  made.latest && read !== null && read > made.at ? justAfter(read) : made.at;

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
