/**
 * Parts of API documents, built the way the API renders them, for the mocks
 * (`handlers.ts` and `test/mocks/`). `__tests__/src/msw/contract.spec.ts`
 * parses every mocked response with api-shared's document schemas.
 */
import {formatMicros, type TagListDocument} from '@commandsnippets/api-shared';

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

/** An error document with one error, as the API sends it. */
export function errorDocument(status: number, code: string, detail: string) {
  return {
    errors: [
      {detail, status: String(status), source: {pointer: '/data'}, code},
    ],
  };
}
