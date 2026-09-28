/**
 * A collection's query parameters, validated as django-rest-framework-json-api
 * and django-filter did: `filter[...]`, `sort`, `page[number]`/`page[size]`,
 * `include`, and `filter[search]`. A query fails at its first error, checked
 * in this order: unknown or repeated parameters, then filters (in parameter
 * order: an empty value, an unknown name, then each value), then `sort`, then
 * `page[number]`, then any refused `include` and `filter[search]`.
 *
 * The input is the query string's `[key, value]` pairs in order
 * (`[...url.searchParams]`).
 */
import {z} from 'zod';
import type {FilterSchema} from './filters';
import {DOCUMENT_POINTER, fail, QUERY_ERROR} from './issues';
import {CODES, MESSAGES} from './messages';

export type QueryEntries = ReadonlyArray<readonly [string, string]>;

/** The default page size, and the largest `page[size]` honored. */
export const PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/**
 * Filters by django-filter name, which joins related fields with `__`
 * (`user__username`); clients may write `.` instead (`filter[user.username]`).
 */
export type FilterSchemas = Readonly<Record<string, FilterSchema>>;

export interface ListQuerySpec<
  F extends FilterSchemas,
  S extends string,
  Search extends SearchMode,
> {
  filters: F;
  /** The fields `sort` accepts, each ascending or (`-field`) descending. */
  sort: readonly S[];
  /**
   * `filter[search]`: a search term (`'supported'`), accepted and ignored
   * (`'ignored'`), or an error (`'refused'`).
   */
  search: Search;
  /**
   * `include`: passed on (`'resolved'`: it is validated when the response is
   * serialized, see `includeSchema`), or an error (`'refused'`), for
   * collections without relationships.
   */
  include: 'resolved' | 'refused';
}

export type SearchMode = 'supported' | 'ignored' | 'refused';

/** One `filter[name]=value`, with the value as its filter outputs it. */
export type FilterValue<F extends FilterSchemas> = {
  [K in keyof F & string]: {name: K; value: z.output<F[K]>};
}[keyof F & string];

export interface SortTerm<S extends string> {
  field: S;
  descending: boolean;
}

export interface ListQuery<
  F extends FilterSchemas = FilterSchemas,
  S extends string = string,
  Search extends SearchMode = SearchMode,
> {
  /** In query-string order; a repeated filter appears once per value. */
  filters: Array<FilterValue<F>>;
  /** The search term; always null unless search is supported. */
  search: Search extends 'supported' ? string | null : null;
  /** Null when absent or empty (the collection's default order applies). */
  sort: Array<SortTerm<S>> | null;
  /** 1-based. */
  page: number;
  pageSize: number;
  /** The raw `include`, or null; always null when refused. */
  include: string | null;
}

/** DJA's QueryParameterValidationFilter: the parameters JSON:API defines. */
const QUERY_PARAM =
  /^(sort|include)$|^(?<kind>filter|fields|page)(\[[\w.-]+\])?$/;
const FILTER_PARAM = /^filter\[([\w.-]+)\]$/;
const SEARCH_PARAM = 'filter[search]';

/** The parameters, grouped: what the stages after key validation read. */
interface Grouped {
  /** `filter[...]` parameters other than search, with every value. */
  filters: Array<[key: string, values: string[]]>;
  sort: string | null;
  /** Null when `page[number]` is absent (page 1). */
  page: string | null;
  pageSize: string | null;
  search: string | null;
  include: string | null;
}

/** Unknown or repeated parameters fail; the rest are grouped. */
const groupedSchema = z
  .array(z.tuple([z.string(), z.string()]))
  .transform((entries, ctx): Grouped => {
    const values = new Map<string, string[]>();
    for (const [key, value] of entries) {
      const list = values.get(key);
      if (list === undefined) {
        values.set(key, [value]);
      } else {
        list.push(value);
      }
    }
    for (const [key, list] of values) {
      const match = QUERY_PARAM.exec(key);
      if (!match) {
        return fail(ctx, MESSAGES.invalidQueryParameter(key), QUERY_ERROR);
      }
      if (match.groups?.['kind'] !== 'filter' && list.length > 1) {
        return fail(ctx, MESSAGES.repeatedQueryParameter(key), QUERY_ERROR);
      }
    }
    const first = (key: string) => values.get(key)?.[0] ?? null;
    return {
      filters: [...values].filter(
        ([key]) => FILTER_PARAM.test(key) && key !== SEARCH_PARAM
      ),
      sort: first('sort'),
      page: first('page[number]'),
      pageSize: first('page[size]'),
      search: first(SEARCH_PARAM),
      include: first('include'),
    };
  });

/** An own property only: `constructor` is nobody's filter. */
function own<T>(
  record: Readonly<Record<string, T>>,
  key: string
): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function filtersSchema<F extends FilterSchemas>(filters: F) {
  return z
    .array(z.tuple([z.string(), z.array(z.string())]))
    .transform((params, ctx) => {
      const parsed: Array<FilterValue<F>> = [];
      for (const [key, values] of params) {
        if (values.some(value => value === '')) {
          return fail(ctx, MESSAGES.missingFilterValue(key), QUERY_ERROR);
        }
        const name = (FILTER_PARAM.exec(key)?.[1] ?? '').replaceAll('.', '__');
        const filter = own(filters, name);
        if (filter === undefined) {
          return fail(ctx, MESSAGES.invalidFilter(name), QUERY_ERROR);
        }
        for (const value of values) {
          const result = filter.safeParse(value);
          if (!result.success) {
            for (const issue of result.error.issues) {
              ctx.addIssue({...issue, path: []});
            }
            return z.NEVER;
          }
          parsed.push({name, value: result.data} as FilterValue<F>);
        }
      }
      return parsed;
    });
}

function sortSchema<S extends string>(fields: readonly S[]) {
  const allowed = new Set<string>(fields);
  return z
    .string()
    .nullable()
    .transform((sort, ctx): Array<SortTerm<S>> | null => {
      if (sort === null || sort === '') {
        return null;
      }
      const terms = sort.split(',').map(term => {
        const field = term.trim();
        return {
          term: field,
          name: field.replaceAll('.', '__').replace(/^-/, ''),
        };
      });
      const bad = terms.filter(({name}) => !allowed.has(name));
      if (bad.length > 0) {
        return fail(
          ctx,
          MESSAGES.invalidSort(bad.map(({term}) => term)),
          QUERY_ERROR
        );
      }
      return terms.map(({term, name}) => ({
        field: name as S,
        descending: term.startsWith('-'),
      }));
    });
}

const positiveInt = (value: string | null) =>
  value !== null && /^\d+$/.test(value) && Number(value) > 0
    ? Number(value)
    : null;

/** `page[number]`: a positive integer, or DRF's 404 `Invalid page.`. */
const pageSchema = z
  .string()
  .nullable()
  .transform((page, ctx) =>
    page === null
      ? 1
      : (positiveInt(page) ??
        fail(ctx, MESSAGES.invalidPage, {
          code: CODES.notFound,
          status: 404,
          pointer: DOCUMENT_POINTER,
        }))
  );

/** `page[size]`: capped at MAX_PAGE_SIZE; anything invalid means the default. */
const pageSizeSchema = z
  .string()
  .nullable()
  .transform(size => Math.min(positiveInt(size) ?? PAGE_SIZE, MAX_PAGE_SIZE));

/** A collection's query parameters (see the module comment). */
export function listQuerySchema<
  F extends FilterSchemas,
  S extends string,
  Search extends SearchMode,
>(
  spec: ListQuerySpec<F, S, Search>
): z.ZodType<ListQuery<F, S, Search>, QueryEntries> {
  return groupedSchema
    .pipe(
      z.object({
        filters: filtersSchema(spec.filters),
        sort: sortSchema(spec.sort),
        page: pageSchema,
        pageSize: pageSizeSchema,
        search: z.string().nullable(),
        include: z.string().nullable(),
      })
    )
    .transform((query, ctx): ListQuery<F, S, Search> => {
      if (spec.include === 'refused' && query.include !== null) {
        return fail(ctx, MESSAGES.includeRefused, QUERY_ERROR);
      }
      if (spec.search === 'refused' && query.search !== null) {
        return fail(ctx, MESSAGES.searchRefused, QUERY_ERROR);
      }
      return {
        ...query,
        search: (spec.search === 'supported'
          ? query.search
          : null) as ListQuery<F, S, Search>['search'],
      };
    });
}
