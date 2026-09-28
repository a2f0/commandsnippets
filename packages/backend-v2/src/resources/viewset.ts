/**
 * The shared ModelViewSet behavior: list with filters/sort/pagination, object
 * lookup with ownership checks, soft deletes, and JSON:API responses.
 */
import {and, asc, count, eq, type SQL} from 'drizzle-orm';
import type {SQLiteColumn, SQLiteTable} from 'drizzle-orm/sqlite-core';
import type {Context} from 'hono';
import type {ContentfulStatusCode} from 'hono/utils/http-status';
import {requireUser} from '../auth/permissions';
import type {tags, textEntries, User} from '../db/schema';
import type {AppEnv} from '../env';
import {notFound, permissionDenied} from '../lib/errors';
import {
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
import {nextRevision, type OwnedResource, type RevisedResource} from './owned';
import {jsonApi} from './responses';
import {createRegistry} from './serializers';

interface ListPageSpec<Row> {
  filters: FilterSpec;
  ordering: OrderingSpec;
  /** Refusals beyond parseListQuery's own, made before anything is read. */
  refuse?: (query: ListQuery) => void;
  /** The condition selecting the listed rows (scope, filters, search). */
  where: (query: ListQuery) => SQL | undefined;
  /** The table counted for pagination. */
  table: SQLiteTable;
  /** Read one page of rows. */
  fetch: (page: {
    query: ListQuery;
    where: SQL | undefined;
    limit: number;
    offset: number;
  }) => Promise<Row[]>;
}

/**
 * The list pipeline every collection shares: validate the query, count the
 * matching rows, 404 on a page past the end, then fetch the page.
 */
export async function listPage<Row>(
  c: Context<AppEnv>,
  spec: ListPageSpec<Row>
): Promise<{query: ListQuery; rows: Row[]; pagination: Pagination}> {
  const url = new URL(c.req.url);
  const query = parseListQuery(url, spec.filters, spec.ordering);
  spec.refuse?.(query);
  const where = spec.where(query);
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

interface ListOptions extends OwnedResource {
  user: User;
  filters: FilterSpec;
  ordering: OrderingSpec;
  defaultOrdering: SQLiteColumn[];
  search?: (term: string) => SQL;
}

/**
 * GET on a collection. Reads are scoped to the requesting user;
 * `filter[search]` is ignored where the resource defines no search.
 */
export async function listResponse(
  c: Context<AppEnv>,
  options: ListOptions
): Promise<Response> {
  const db = c.get('db');
  const {query, rows, pagination} = await listPage(c, {
    filters: options.filters,
    ordering: options.ordering,
    table: options.table,
    where: query => {
      const conditions = [
        eq(options.userId, options.user.id),
        ...query.filters,
      ];
      if (query.search !== null && options.search !== undefined) {
        conditions.push(options.search(query.search));
      }
      return and(...conditions);
    },
    // The requested fields (or the model's Meta.ordering), then the primary
    // key.
    fetch: async ({query, where, limit, offset}) =>
      (await db
        .select()
        .from(options.table)
        .where(where)
        .orderBy(
          ...pageOrder(
            query,
            options.defaultOrdering.map(column => asc(column)),
            asc(options.id)
          )
        )
        .limit(limit)
        .offset(offset)) as Array<{id: number}>,
  });

  const {data, included} = await serialize(
    createRegistry(db, options.user.id),
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
 * 404 when missing, 403 when owned by someone else.
 */
export async function getOwned<Row extends {user_id: number}>(
  c: Context<AppEnv>,
  {type, table, id}: OwnedResource
): Promise<Row> {
  const user = requireUser(c);
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
  const {data, included} = await serialize(
    createRegistry(c.get('db'), requireUser(c).id),
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

/** DELETE that flags the row `is_deleted` and advances its revision. */
export async function softDelete(
  c: Context<AppEnv>,
  resource: SoftDeletedResource
): Promise<Response> {
  const row = await getOwned<{id: number; user_id: number}>(c, resource);
  const [deleted] = await c
    .get('db')
    .update(resource.table)
    .set({
      is_deleted: true,
      date_updated: nextRevision(resource, row.user_id),
    })
    .where(eq(resource.id, row.id))
    .returning();
  return resourceResponse(c, resource.type, deleted as {id: number});
}
