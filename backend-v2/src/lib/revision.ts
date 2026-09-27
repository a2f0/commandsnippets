/**
 * `date_updated` values assigned by the database at write time. Clients sync
 * with `filter[date_updated.gt]=<latest seen>`, so each user's rows must get
 * strictly increasing values in commit order. A Worker's clock cannot promise
 * that: separate isolates on separate machines can be skewed, or hand out the
 * same microsecond. D1 serializes writes, so a value computed inside the write
 * itself - the later of D1's clock and one microsecond past the user's latest
 * row - is strictly increasing per user and table.
 *
 * Timestamps stay in the fixed-width text format of `lib/clock.ts`; they are
 * converted to integer microseconds and back in SQL (julianday() would lose
 * the microseconds to floating point).
 */
import {type SQL, sql} from 'drizzle-orm';
import type {SQLiteColumn, SQLiteTable} from 'drizzle-orm/sqlite-core';

const micros = (column: SQLiteColumn) =>
  sql`(unixepoch(substr(${column}, 1, 19)) * 1000000 + CAST(substr(${column}, 21, 6) AS INTEGER))`;

/** The next `date_updated` for `ownerId`'s rows in `table`, as a subquery. */
export function revision(
  table: SQLiteTable,
  dateUpdated: SQLiteColumn,
  owner: SQLiteColumn,
  ownerId: number
): SQL {
  return sql`(
    SELECT strftime('%Y-%m-%dT%H:%M:%S', v / 1000000, 'unixepoch') || '.' || printf('%06d', v % 1000000)
    FROM (
      SELECT MAX(
        CAST(unixepoch('subsec') * 1000000 AS INTEGER),
        COALESCE(MAX(${micros(dateUpdated)}), 0) + 1
      ) AS v
      FROM ${table}
      WHERE ${owner} = ${ownerId}
    )
  )`;
}
