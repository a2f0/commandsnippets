/**
 * The shared ModelViewSet behavior: list with filters/sort/pagination, object
 * lookup with ownership checks, and JSON:API responses.
 */
import {and, asc, count, eq, type SQL} from 'drizzle-orm';
import type {SQLiteColumn, SQLiteTable} from 'drizzle-orm/sqlite-core';
import type {Context} from 'hono';
import type {ContentfulStatusCode} from 'hono/utils/http-status';
import {requireUser} from '../auth/tokens';
import type {User} from '../db/schema';
import type {AppEnv} from '../env';
import {notFound, permissionDenied} from '../lib/errors';
import {
  document,
  type FilterSpec,
  type OrderingSpec,
  paginate,
  parseListQuery,
  serialize,
} from '../lib/jsonapi';
import {createRegistry} from './serializers';

export const JSON_API = 'application/vnd.api+json';

export function jsonApi(
  c: Context<AppEnv>,
  body: unknown,
  status: ContentfulStatusCode = 200
): Response {
  return c.body(JSON.stringify(body), status, {'Content-Type': JSON_API});
}

interface OwnedTable {
  table: SQLiteTable;
  id: SQLiteColumn;
  userId: SQLiteColumn;
}

export interface ListOptions extends OwnedTable {
  type: string;
  user: User;
  filters: FilterSpec;
  ordering: OrderingSpec;
  defaultOrdering: SQLiteColumn[];
  search?: (term: string) => SQL;
}

/** GET on a collection. Reads are scoped to the requesting user. */
export async function listResponse(
  c: Context<AppEnv>,
  options: ListOptions
): Promise<Response> {
  const db = c.get('db');
  const url = new URL(c.req.url);
  const query = parseListQuery(url, options.filters, options.ordering);
  const conditions = [eq(options.userId, options.user.id), ...query.filters];
  if (query.search !== null && options.search !== undefined) {
    conditions.push(options.search(query.search));
  }
  const where = and(...conditions);

  const [total] = await db
    .select({value: count()})
    .from(options.table)
    .where(where);
  const pagination = paginate(url, query, total?.value ?? 0);

  // Order by the requested fields (or the model's Meta.ordering), with the
  // primary key as a final tie-breaker so pages are stable.
  const orderBy = [
    ...(query.orderBy ?? options.defaultOrdering.map(column => asc(column))),
    asc(options.id),
  ];
  const rows = (await db
    .select()
    .from(options.table)
    .where(where)
    .orderBy(...orderBy)
    .limit(query.pageSize)
    .offset(pagination.offset)) as Array<{id: number}>;

  const {data, included} = await serialize(
    createRegistry(db, options.user.id),
    options.type,
    rows,
    query.include
  );
  return jsonApi(
    c,
    document(data, included, {links: pagination.links, meta: pagination.meta})
  );
}

/** Parse a URL primary key; anything but a positive integer is a 404. */
export function parseId(value: string | undefined, model: string): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw notFound(`No ${model} matches the given query.`);
  }
  return Number(value);
}

/**
 * `get_object()` followed by the IsOwner object permission: 404 when missing,
 * 403 when owned by someone else.
 */
export async function getOwned<Row extends {user_id: number}>(
  c: Context<AppEnv>,
  {table, id}: OwnedTable,
  rawId: string | undefined,
  model: string,
  user: User
): Promise<Row> {
  const [row] = (await c
    .get('db')
    .select()
    .from(table)
    .where(eq(id, parseId(rawId, model)))
    .limit(1)) as Row[];
  if (row === undefined) {
    throw notFound(`No ${model} matches the given query.`);
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
