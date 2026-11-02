/**
 * Collection query parameters (validated by api-shared's schemas) as SQL
 * filters and ordering, and pagination with DJA's `links` and `meta`.
 */
import {
  type Cursor,
  type FilterSchemas,
  MESSAGES,
  type QueryEntries,
  type SearchMode,
  type ListQuery as SharedListQuery,
} from '@commandsnippets/api-shared';
import {desc, type SQL} from 'drizzle-orm';
import type * as z from 'zod/mini';
import {notFound} from '../errors';
import {parseOrThrow} from '../validate';
import {document, type ResourceObject} from './serialize';

/** Each filter's SQL condition, built from its parsed value. */
export type FilterSpec<F extends FilterSchemas> = {
  [K in keyof F & string]: (value: z.output<F[K]>) => SQL;
};

/** Maps each sortable field to the SQL expression to order by. */
export type OrderingSpec<S extends string> = Record<S, SQL>;

/** A collection query as SQL: api-shared's `ListQuery`, with conditions. */
export interface ListQuery {
  filters: SQL[];
  search: string | null;
  orderBy: SQL[] | null;
  page: number;
  pageSize: number;
  /** A keyset page's cursor (`page[after]`), or null for a numbered page. */
  after: Cursor | null;
  include: string | null;
}

/**
 * Validate a collection's query parameters with its api-shared schema (the
 * first error is thrown), then build its filters' conditions and ordering.
 */
export function parseListQuery<
  F extends FilterSchemas,
  S extends string,
  Search extends SearchMode,
>(
  url: URL,
  schema: z.ZodMiniType<SharedListQuery<F, S, Search>, QueryEntries>,
  filterSpec: FilterSpec<F>,
  orderingSpec: OrderingSpec<S>
): ListQuery {
  const query = parseOrThrow(schema, [...url.searchParams]);
  return {
    filters: query.filters.map(({name, value}) =>
      (filterSpec[name] as (value: unknown) => SQL)(value)
    ),
    search: query.search,
    orderBy:
      query.sort?.map(({field, descending}) =>
        descending ? desc(orderingSpec[field]) : orderingSpec[field]
      ) ?? null,
    page: query.page,
    pageSize: query.pageSize,
    after: query.after,
    include: query.include,
  };
}

/** A numbered page's place in its collection, or a keyset page's link on. */
export type Pagination = NumberedPagination | CursorPagination;

interface NumberedPagination {
  offset: number;
  links: Record<string, string | null>;
  meta: {pagination: {page: number; pages: number; count: number}};
}

/** A keyset page (`page[after]`): the page after it, when there is one. */
interface CursorPagination {
  links: {next: string | null};
}

/** Page-number pagination with DJA's links/meta shape. */
export function paginate(
  url: URL,
  query: ListQuery,
  count: number
): NumberedPagination {
  const pages = Math.max(1, Math.ceil(count / query.pageSize));
  if (query.page > pages) {
    throw notFound(MESSAGES.invalidPage);
  }
  const link = (page: number | null) => {
    if (page === null) {
      return null;
    }
    const target = new URL(url);
    target.searchParams.set('page[number]', String(page));
    return target.toString();
  };
  return {
    offset: (query.page - 1) * query.pageSize,
    links: {
      first: link(1),
      last: link(pages),
      next: link(query.page < pages ? query.page + 1 : null),
      prev: link(query.page > 1 ? query.page - 1 : null),
    },
    meta: {pagination: {page: query.page, pages, count}},
  };
}

/**
 * A page of a collection: DJA's `links` and `meta` (a keyset page's `links`),
 * then `data`/`included`.
 */
export function listDocument(
  data: ResourceObject[],
  included: ResourceObject[],
  pagination: Pagination
): Record<string, unknown> {
  return document(
    data,
    included,
    'meta' in pagination
      ? {links: pagination.links, meta: pagination.meta}
      : {links: pagination.links}
  );
}

/**
 * A keyset page's links: `next` pages after `cursor`, the page's last row,
 * when rows are left past it.
 */
export function cursorPagination(
  url: URL,
  cursor: string | null
): CursorPagination {
  if (cursor === null) {
    return {links: {next: null}};
  }
  const next = new URL(url);
  next.searchParams.set('page[after]', cursor);
  return {links: {next: next.toString()}};
}
