/**
 * Keyset pages (`page[after]`) as the API renders them (backend-v2's
 * `listPage`): the rows past a cursor in revision order (`date_updated`, then
 * id), uncounted, with `links.next` while rows are left. For the mocks.
 */
import {
  CODES,
  type Cursor,
  isPast,
  MESSAGES,
  parseCursor,
  parseDateTime,
} from '@commandsnippets/api-shared';
import {apiError} from './requests';

/** The largest `page[size]` the API honors, and its default. */
const MAX_PAGE_SIZE = 100;
const PAGE_SIZE = 50;

interface Revised {
  id: string;
  attributes: {date_updated: string};
}

/** `resource`'s place in revision order. */
export function positionOf(resource: Revised): Cursor {
  return {
    dateUpdated:
      parseDateTime(resource.attributes.date_updated) ??
      resource.attributes.date_updated,
    id: Number(resource.id),
  };
}

/** Revision order: `date_updated`, then id. */
export function byRevision(a: Revised, b: Revised): number {
  const [x, y] = [positionOf(a), positionOf(b)];
  return isPast(x, y) ? 1 : isPast(y, x) ? -1 : 0;
}

/**
 * The request's cursor, or null for a numbered page; the API's 400 for one
 * that is not a cursor, or that comes with a page number or a sort.
 */
export function afterOf(url: URL): Cursor | null {
  const after = url.searchParams.get('page[after]');
  if (after === null) {
    return null;
  }
  const cursor = parseCursor(after);
  if (cursor === null) {
    throw apiError(400, CODES.invalid, MESSAGES.invalidCursor(after));
  }
  if (url.searchParams.has('page[number]')) {
    throw apiError(400, CODES.invalid, MESSAGES.cursorWithPage);
  }
  if (url.searchParams.has('sort')) {
    throw apiError(400, CODES.invalid, MESSAGES.cursorWithSort);
  }
  return cursor;
}

/** The page of `rows` after `after` (the request's), and its `links`. */
export function keysetPage<R extends Revised>(
  url: URL,
  rows: readonly R[],
  after: Cursor
): {data: R[]; links: {next: string | null}} {
  const requested = Number(url.searchParams.get('page[size]'));
  const size =
    Number.isInteger(requested) && requested > 0
      ? Math.min(requested, MAX_PAGE_SIZE)
      : PAGE_SIZE;
  const past = rows
    .filter(row => isPast(positionOf(row), after))
    .sort(byRevision);
  const data = past.slice(0, size);
  const last = data.at(-1);
  if (past.length === data.length || last === undefined) {
    return {data, links: {next: null}};
  }
  const next = new URL(url);
  next.searchParams.set(
    'page[after]',
    `${last.attributes.date_updated},${last.id}`
  );
  return {data, links: {next: next.toString()}};
}
