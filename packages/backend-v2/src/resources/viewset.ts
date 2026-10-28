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
import type {RunnableQuery} from 'drizzle-orm/runnable-query';
import type {
  SQLiteColumn,
  SQLiteTable,
  SQLiteUpdateSetSource,
} from 'drizzle-orm/sqlite-core';
import type {Context} from 'hono';
import type {ContentfulStatusCode} from 'hono/utils/http-status';
import type * as z from 'zod/mini';
import {requireUser} from '../auth/permissions';
import {isUniqueViolation} from '../db/errors';
import type {entryReuses, tags, textEntries, User} from '../db/schema';
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

/**
 * A page's query: run on its own, or batched with its count. Drizzle reads a
 * batch's rows by column name, so its columns must be named apart.
 */
export type PageQuery<Row> = RunnableQuery<Row[], 'sqlite'> &
  PromiseLike<Row[]>;

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
  /** The query for one page of rows, in `orderBy` when given (a keyset page's). */
  fetch: (page: {
    query: ListQuery;
    where: SQL | undefined;
    limit: number;
    offset: number;
    orderBy?: SQL[];
  }) => PageQuery<Row>;
}

/**
 * The list pipeline every collection shares: validate the query, count the
 * matching rows and fetch the page, in one D1 batch, then 404 on a page past
 * the end. A keyset page (`page[after]`) instead reads the rows past its
 * cursor in revision order, uncounted, and one more to tell whether a page
 * follows.
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
  // A page's offset does not depend on the count, so both are read in one
  // round trip (and as of one moment); the count then tells whether the page
  // is past the end. An offset past what D1 binds exactly is past the end of
  // any table, so it reads no rows either way.
  const db = c.get('db');
  const [[total], rows] = await db.batch([
    db.select({value: count()}).from(spec.table).where(where),
    spec.fetch({
      query,
      where,
      limit: query.pageSize,
      offset: Math.min(
        (query.page - 1) * query.pageSize,
        Number.MAX_SAFE_INTEGER
      ),
    }),
  ]);
  const pagination = paginate(url, query, total?.value ?? 0);
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
  /**
   * Whose rows are listed, of the data version the request reads them at
   * (`versionOf`).
   */
  user: User;
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
  const dataVersion = versionOf(c, options.user);
  const {query, rows, pagination} = await listPage(c, {
    query: options.query,
    filters: options.filters,
    ordering: options.ordering,
    table: options.table,
    where: query => {
      const conditions = [
        eq(options.userId, options.user.id),
        eq(options.version, dataVersion),
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
    fetch: ({query, where, limit, offset, orderBy}) =>
      db
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
        .offset(offset) as unknown as PageQuery<RevisedRow>,
  });

  const {data, included} = await serialize(
    createRegistry(db, options.user, dataVersion, options.publicOnly),
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
    createRegistry(c.get('db'), user, versionOf(c, user)),
    type,
    [row],
    include
  );
  return jsonApi(c, document(data[0] ?? null, included), status);
}

type SoftDeletedTable = typeof tags | typeof textEntries;

/** A resource whose rows are soft-deleted (`is_deleted`), never removed. */
interface SoftDeletedResource<T extends SoftDeletedTable = SoftDeletedTable>
  extends RevisedResource {
  table: T;
}

/** A row as `getOwned` reads it. */
type OwnedRow = {id: number; user_id: number; version: number};

/**
 * Write `changes` to `row` (as `getOwned` read it) and advance its revision,
 * unless a newer client write stands (resources/lww.ts): the response is the
 * row either way, as written or as it stands.
 */
export async function writeOwned<T extends SoftDeletedTable>(
  c: Context<AppEnv>,
  resource: SoftDeletedResource<T>,
  row: OwnedRow,
  changes: SQLiteUpdateSetSource<T>
): Promise<Response> {
  const at = await clientUpdated(c);
  const [written] = await c
    .get('db')
    .update(resource.table)
    .set({
      ...changes,
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
    written ?? (await getOwned<OwnedRow>(c, resource))
  );
}

/** DELETE that flags the row `is_deleted` (`writeOwned`). */
export async function softDelete(
  c: Context<AppEnv>,
  resource: SoftDeletedResource
): Promise<Response> {
  const row = await getOwned<OwnedRow>(c, resource);
  return writeOwned(c, resource, row, {is_deleted: true});
}

/** A resource whose creates name the client's id for the row (`clientId`). */
interface ClientCreatedResource extends OwnedResource {
  table: typeof textEntries | typeof entryReuses;
  clientId: SQLiteColumn;
}

/**
 * POST that makes a row (201) with `insert`, once per client id: a create
 * naming one the owner's rows (of the version) already have answers with
 * that row, as its first attempt was answered (201), so a queued create
 * retried after a lost answer is made once.
 */
export async function createOnce(
  c: Context<AppEnv>,
  resource: ClientCreatedResource,
  {
    userId,
    version,
    clientId,
  }: {userId: number; version: number; clientId: string | undefined},
  insert: () => PromiseLike<{id: number}[]>
): Promise<Response> {
  const db = c.get('db');
  const made = async () =>
    clientId === undefined
      ? undefined
      : (
          await db
            .select()
            .from(resource.table)
            .where(
              and(
                eq(resource.userId, userId),
                eq(resource.version, version),
                eq(resource.clientId, clientId)
              )
            )
            .limit(1)
        )[0];
  const existing = await made();
  if (existing !== undefined) {
    return resourceResponse(c, resource.type, existing, 201);
  }
  try {
    const [created] = await insert();
    return resourceResponse(c, resource.type, created as {id: number}, 201);
  } catch (error) {
    // Lost a race with the same create, retried.
    const raced = isUniqueViolation(error) ? await made() : undefined;
    if (raced === undefined) {
      throw error;
    }
    return resourceResponse(c, resource.type, raced, 201);
  }
}
