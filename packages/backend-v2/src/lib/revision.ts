/**
 * `date_updated` values assigned by the database at write time. Clients sync
 * by revision (keyset reads past the last `date_updated` and id seen,
 * `page[after]`; `filter[date_updated.gt]` too), so each user's rows must get
 * strictly increasing values in commit order. A Worker's clock cannot promise
 * that: separate isolates on separate machines can be skewed, or hand out the
 * same microsecond. D1 serializes writes, so a value computed inside the write
 * itself - the later of D1's clock and one millisecond past the user's latest
 * row - is strictly increasing per user and table.
 *
 * The step is a millisecond, not a microsecond, for clients that compare
 * revisions as JavaScript Dates (millisecond precision): two revisions in the
 * same millisecond would look equal and the newer edit could be dropped. (The
 * web app compares the fixed-width strings, which a microsecond would do.)
 *
 * Timestamps stay in the fixed-width text format of `lib/clock.ts`; they are
 * converted to integer microseconds and back in SQL (julianday() would lose
 * the microseconds to floating point).
 *
 * The triggers of `migrations/0008_tag_revisions.sql` and
 * `0010_junction_revisions.sql` advance tags and junctions with the same
 * formula written out in SQL (a tag's revision, and its junctions', move with
 * its entries): a change here needs a migration re-creating them.
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
        COALESCE(MAX(${micros(dateUpdated)}), 0) + 1000
      ) AS v
      FROM ${table}
      WHERE ${owner} = ${ownerId}
    )
  )`;
}
