/**
 * The shared ModelViewSet behavior: list with filters/sort/pagination, object
 * lookup with ownership checks, soft deletes, and JSON:API responses.
 */
import type {
  FilterSchemas,
  QueryEntries,
  SearchMode,
  ListQuery as SharedListQuery,
} from '@commandsnippets/api-shared';
import {and, asc, count, eq, getTableColumns, type SQL, sql} from 'drizzle-orm';
import type {SQLiteColumn, SQLiteTable} from 'drizzle-orm/sqlite-core';
import type {Context} from 'hono';
import type {ContentfulStatusCode} from 'hono/utils/http-status';
import type * as z from 'zod/mini';
import {requireUser} from '../auth/permissions';
import type {tags, textEntries, User} from '../db/schema';
import type {AppEnv} from '../env';
import {isoformat} from '../lib/clock';
import {notFound, permissionDenied} from '../lib/errors';
import {
  cursorPagination,
  document,
  type FilterSpec,
  type ListQuery,
  listDocument,
  type OrderingSpec,
  type Pagination,
  paginate,
  parseListQuery,
  serialize,
} from '../lib/jsonapi';
import {versionOf} from './dataVersions';
import {clientUpdated, writtenBefore} from './lww';
import {nextRevision, type OwnedResource, type RevisedResource} from './owned';
import {jsonApi} from './responses';
import {createRegistry} from './serializers';

/**
 * A collection's query: its api-shared schema, which validates the parameters
 * (and refuses what the collection does not support), and the SQL for its
 * filters and sort fields.
 */
export interface CollectionQuery<
  F extends FilterSchemas,
  S extends string,
  Search extends SearchMode,
> {
  query: z.ZodMiniType<SharedListQuery<F, S, Search>, QueryEntries>;
  filters: NoInfer<FilterSpec<F>>;
  ordering: NoInfer<OrderingSpec<S>>;
}

/** Revision order, for keyset pages (`page[after]`). */
interface RevisionOrder<Row> {
  dateUpdated: SQLiteColumn;
  id: SQLiteColumn;
  /** The cursor at a row: its rendered revision and id (api-shared's `cursorOf`). */
  cursor: (row: Row) => string;
}

interface ListPageSpec<
  Row,
  F extends FilterSchemas,
  S extends string,
  Search extends SearchMode,
> extends CollectionQuery<F, S, Search> {
  /** The condition selecting the listed rows (scope, filters, search). */
  where: (query: ListQuery) => SQL | undefined;
  /** The table counted for pagination. */
  table: SQLiteTable;
  /** Where the query schema supports `page[after]`. */
  revisions?: RevisionOrder<Row>;
  /** Read one page of rows, in `orderBy` when given (a keyset page's). */
  fetch: (page: {
    query: ListQuery;
    where: SQL | undefined;
    limit: number;
    offset: number;
    orderBy?: SQL[];
  }) => Promise<Row[]>;
}

/**
 * The list pipeline every collection shares: validate the query, count the
 * matching rows, 404 on a page past the end, then fetch the page. A keyset
 * page (`page[after]`) instead reads the rows past its cursor in revision
 * order, uncounted, and one more to tell whether a page follows.
 */
export async function listPage<
  Row,
  F extends FilterSchemas,
  S extends string,
  Search extends SearchMode,
>(
  c: Context<AppEnv>,
  spec: ListPageSpec<Row, F, S, Search>
): Promise<{query: ListQuery; rows: Row[]; pagination: Pagination}> {
  const url = new URL(c.req.url);
  const query = parseListQuery(url, spec.query, spec.filters, spec.ordering);
  const where = spec.where(query);
  if (query.after !== null) {
    if (spec.revisions === undefined) {
      throw new Error('page[after] needs a collection in revision order');
    }
    const {dateUpdated, id, cursor} = spec.revisions;
    const rows = await spec.fetch({
      query,
      where: and(
        where,
        sql`(${dateUpdated}, ${id}) > (${query.after.dateUpdated}, ${query.after.id})`
      ),
      limit: query.pageSize + 1,
      offset: 0,
      orderBy: [asc(dateUpdated), asc(id)],
    });
    const page = rows.slice(0, query.pageSize);
    const last = page.at(-1);
    return {
      query,
      rows: page,
      pagination: cursorPagination(
        url,
        rows.length > page.length && last !== undefined ? cursor(last) : null
      ),
    };
  }
  const [total] = await c
    .get('db')
    .select({value: count()})
    .from(spec.table)
    .where(where);
  const pagination = paginate(url, query, total?.value ?? 0);
  const rows = await spec.fetch({
    query,
    where,
    limit: query.pageSize,
    offset: pagination.offset,
  });
  return {query, rows, pagination};
}

/**
 * ORDER BY for a page: the requested sort (or the default), then a unique
 * tie-breaker so pages are stable.
 */
export function pageOrder(
  query: ListQuery,
  defaults: SQL[],
  tieBreaker: SQL
): SQL[] {
  return [...(query.orderBy ?? defaults), tieBreaker];
}

/** A listed row: rows carry a revision where keyset pages are supported. */
interface RevisedRow {
  id: number;
  date_updated: string;
}

interface ListOptions<
  F extends FilterSchemas,
  S extends string,
  Search extends SearchMode,
> extends OwnedResource,
    CollectionQuery<F, S, Search> {
  /** The rows' revision, for keyset pages (where the query supports them). */
  dateUpdated?: SQLiteColumn;
  user: User;
  /** The data version read (`versionOf`). */
  dataVersion: number;
  publicOnly?: boolean;
  visibility?: SQL;
  fields?: Record<string, SQLiteColumn | SQL>;
  defaultOrdering: SQLiteColumn[];
  /** `filter[search]`, where the query schema supports it. */
  search?: (term: string) => SQL;
}

/**
 * GET on a collection. Reads are scoped to the requesting user;
 * `filter[search]` applies where the query schema supports it.
 */
export async function listResponse<
  F extends FilterSchemas,
  S extends string,
  Search extends SearchMode,
>(c: Context<AppEnv>, options: ListOptions<F, S, Search>): Promise<Response> {
  const db = c.get('db');
  const {query, rows, pagination} = await listPage(c, {
    query: options.query,
    filters: options.filters,
    ordering: options.ordering,
    table: options.table,
    where: query => {
      const conditions = [
        eq(options.userId, options.user.id),
        eq(options.version, options.dataVersion),
        ...(options.visibility === undefined ? [] : [options.visibility]),
        ...query.filters,
      ];
      if (query.search !== null && options.search !== undefined) {
        conditions.push(options.search(query.search));
      }
      return and(...conditions);
    },
    ...(options.dateUpdated === undefined
      ? {}
      : {
          revisions: {
            dateUpdated: options.dateUpdated,
            id: options.id,
            cursor: (row: RevisedRow) =>
              `${isoformat(row.date_updated)},${row.id}`,
          },
        }),
    // The requested fields (or the model's Meta.ordering), then the primary
    // key.
    fetch: async ({query, where, limit, offset, orderBy}) =>
      (await db
        .select(options.fields ?? getTableColumns(options.table))
        .from(options.table)
        .where(where)
        .orderBy(
          ...(orderBy ??
            pageOrder(
              query,
              options.defaultOrdering.map(column => asc(column)),
              asc(options.id)
            ))
        )
        .limit(limit)
        .offset(offset)) as unknown as RevisedRow[],
  });

  const {data, included} = await serialize(
    createRegistry(
      db,
      options.user.id,
      options.dataVersion,
      options.publicOnly
    ),
    options.type,
    rows,
    query.include
  );
  return jsonApi(c, listDocument(data, included, pagination));
}

/** Parse a URL primary key; anything but a positive integer is a 404. */
export function parseId(value: string | undefined, model: string): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw notFound(`No ${model} matches the given query.`);
  }
  return Number(value);
}

/**
 * `get_object()` for the `:id` route parameter, followed by the IsOwner
 * object permission: 403 when anonymous (checked before the id is parsed),
 * 404 when missing or of another data version than the request's
 * (`versionOf`), 403 when owned by someone else.
 */
export async function getOwned<Row extends {user_id: number; version: number}>(
  c: Context<AppEnv>,
  {type, table, id}: OwnedResource
): Promise<Row> {
  const user = requireUser(c);
  const version = versionOf(c, user);
  const [row] = (await c
    .get('db')
    .select()
    .from(table)
    .where(eq(id, parseId(c.req.param('id'), type)))
    .limit(1)) as Row[];
  if (row === undefined) {
    throw notFound(`No ${type} matches the given query.`);
  }
  if (row.user_id !== user.id) {
    throw permissionDenied();
  }
  if (row.version !== version) {
    throw notFound(`No ${type} matches the given query.`);
  }
  return row;
}

/**
 * Render a single resource (with its default or requested includes), loading
 * related rows only from the requesting user's data.
 */
export async function resourceResponse(
  c: Context<AppEnv>,
  type: string,
  row: {id: number},
  status: ContentfulStatusCode = 200
): Promise<Response> {
  const include = new URL(c.req.url).searchParams.get('include');
  const user = requireUser(c);
  const {data, included} = await serialize(
    createRegistry(c.get('db'), user.id, versionOf(c, user)),
    type,
    [row],
    include
  );
  return jsonApi(c, document(data[0] ?? null, included), status);
}

/** A resource whose rows are soft-deleted (`is_deleted`), never removed. */
interface SoftDeletedResource extends RevisedResource {
  table: typeof tags | typeof textEntries;
}

/**
 * DELETE that flags the row `is_deleted` and advances its revision, unless a
 * newer client write stands (resources/lww.ts): the response is the row
 * either way.
 */
export async function softDelete(
  c: Context<AppEnv>,
  resource: SoftDeletedResource
): Promise<Response> {
  const row = await getOwned<{id: number; user_id: number; version: number}>(
    c,
    resource
  );
  const at = await clientUpdated(c);
  const [deleted] = await c
    .get('db')
    .update(resource.table)
    .set({
      is_deleted: true,
      client_updated: at,
      date_updated: nextRevision(resource, row.user_id),
    })
    .where(
      and(eq(resource.id, row.id), writtenBefore(resource.clientUpdated, at))
    )
    .returning();
  return resourceResponse(
    c,
    resource.type,
    (deleted as {id: number} | undefined) ??
      (await getOwned<{id: number; user_id: number; version: number}>(
        c,
        resource
      ))
  );
}
