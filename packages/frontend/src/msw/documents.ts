/**
 * Parts of API documents, built the way the API renders them, for the mocks
 * (`handlers.ts` and `test/mocks/`). `__tests__/src/msw/contract.spec.ts`
 * parses every mocked response with api-shared's document schemas.
 */
import {
  formatMicros,
  parseDateTime,
  type TagListDocument,
} from '@commandsnippets/api-shared';

type Pagination = Pick<TagListDocument, 'links' | 'meta'>;

/**
 * The `links` and `meta` of `page` of `pages` of a collection of `count`
 * (DJA's page-number pagination): `url` is the collection's, as requested.
 */
export function pagination(
  url: string,
  page: number,
  pages: number,
  count: number
): Pagination {
  const linkTo = (target: number) => {
    const link = new URL(url);
    link.searchParams.set('page[number]', String(target));
    return link.toString();
  };
  return {
    links: {
      first: linkTo(1),
      last: linkTo(pages),
      next: page < pages ? linkTo(page + 1) : null,
      prev: page > 1 ? linkTo(page - 1) : null,
    },
    meta: {pagination: {page, pages, count}},
  };
}

/** `pagination` of a collection that fits on one page. */
export function onePage(url: string, count: number): Pagination {
  return pagination(url, 1, 1, count);
}

/** The current time as the API renders timestamps (naive UTC, microseconds). */
export function now(): string {
  return formatMicros(Date.now() * 1000);
}

/** A rendered timestamp as microseconds since the epoch. */
function toMicros(timestamp: string): number {
  const fixed = parseDateTime(timestamp) ?? '1970-01-01T00:00:00.000000';
  return (
    Date.parse(`${fixed.slice(0, 19)}Z`) * 1000 + Number(fixed.slice(20, 26))
  );
}

/**
 * The next `date_updated` of a user's rows in one table, given theirs
 * (backend-v2's `lib/revision.ts`): the current time, or a millisecond past
 * the latest of `revisions`, whichever is later, so each write's revision is
 * newer than every earlier one. Rendered as Python's `isoformat()` does.
 */
export function nextRevision(revisions: readonly string[]): string {
  const latest = Math.max(0, ...revisions.map(toMicros));
  const next = formatMicros(Math.max(Date.now() * 1000, latest + 1000));
  return next.endsWith('.000000') ? next.slice(0, 19) : next;
}

/** An error document with one error, as the API sends it. */
export function errorDocument(status: number, code: string, detail: string) {
  return {
    errors: [
      {detail, status: String(status), source: {pointer: '/data'}, code},
    ],
  };
}
