/**
 * Keyset cursors (`page[after]`): a position in a collection ordered by
 * revision, `date_updated` then `id`. A page after a cursor lists the rows
 * past it, oldest first, so a client that reads page after page, each from
 * the last row of the one before, reads every row changed since it started:
 * a row that changes meanwhile gets a newer revision and moves past the
 * cursor, where a later page lists it (again). Offset pages would shift
 * under it instead, and a `filter[date_updated.gt]` cursor alone would skip
 * the rows one write stamped with the same revision that a page boundary
 * split.
 *
 * A cursor is `<date_updated>,<id>`, the last row's revision as rendered and
 * its id. Like `datetime.ts`, this module imports no zod, so clients can use
 * it without bundling the request schemas.
 */
import {parseDateTime} from './datetime';

/** A position in revision order. */
export interface Cursor {
  /** In the fixed-width stored form (`YYYY-MM-DDTHH:MM:SS.ffffff`). */
  dateUpdated: string;
  id: number;
}

/** The cursor before every row: page after it for the whole collection. */
export const CURSOR_START = '1970-01-01T00:00:00,0';

/** The cursor at `resource`: page after it for the rows past it. */
export function cursorOf(resource: {
  id: string;
  attributes: {date_updated: string};
}): string {
  return `${resource.attributes.date_updated},${resource.id}`;
}

/** Parse a `page[after]` value; null when it is not a cursor. */
export function parseCursor(value: string): Cursor | null {
  const comma = value.lastIndexOf(',');
  const digits = value.slice(comma + 1);
  const id = Number(digits);
  const dateUpdated = parseDateTime(value.slice(0, comma));
  // An id past 2^53 would round to another row's.
  if (
    comma === -1 ||
    !/^\d+$/.test(digits) ||
    !Number.isSafeInteger(id) ||
    dateUpdated === null
  ) {
    return null;
  }
  return {dateUpdated, id};
}

/**
 * Whether revision-ordered `a` is past `b`. Compares the stored forms, which
 * order chronologically as strings; for rendered revisions, compare their
 * cursors' parses.
 */
export function isPast(a: Cursor, b: Cursor): boolean {
  return (
    a.dateUpdated > b.dateUpdated ||
    (a.dateUpdated === b.dateUpdated && a.id > b.id)
  );
}
