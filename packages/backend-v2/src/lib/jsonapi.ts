/**
 * A small port of the parts of django-rest-framework-json-api this API used:
 * request document parsing, resource serialization with `include`, and the
 * query-parameter/filter/sort/pagination conventions. What they accept, and
 * their error messages (which clients and tests rely on), are api-shared's
 * schemas.
 */
import {
  type Cursor,
  type FilterSchemas,
  includePathsSchema,
  MESSAGES,
  type QueryEntries,
  type RelationshipGraph,
  type RequestResource,
  requestEnvelopeSchema,
  type SearchMode,
  type ListQuery as SharedListQuery,
  splitInclude,
} from '@commandsnippets/api-shared';
import {desc, type SQL} from 'drizzle-orm';
import type * as z from 'zod/mini';
import {notFound, parseError, unsupportedMediaType} from './errors';
import {parseOrThrow} from './validate';

// ---------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------

interface ParseOptions {
  /** The resource type the endpoint accepts (DJA's resource_name). */
  type: string;
  /** For PATCH/PUT: the id from the URL, which the document must match. */
  id?: string;
}

/** The JSON:API media type, which every response document is sent as. */
export const JSON_API_MEDIA_TYPE = 'application/vnd.api+json';

/**
 * Request bodies must be JSON. Both accepted types make a cross-origin request
 * "non-simple", so the browser preflights it and the CORS allowlist applies;
 * `text/plain` or form posts would otherwise skip the preflight (login CSRF).
 * DRF-JSON:API likewise answered other media types with 415.
 */
const JSON_MEDIA_TYPES = new Set([JSON_API_MEDIA_TYPE, 'application/json']);

/** 415 unless the request declares a JSON body. */
export function assertJsonMediaType(request: Request): void {
  const mediaType = (request.headers.get('Content-Type') ?? '')
    .split(';', 1)[0]
    ?.trim()
    .toLowerCase();
  if (!JSON_MEDIA_TYPES.has(mediaType ?? '')) {
    throw unsupportedMediaType(mediaType);
  }
}

/**
 * A request document's primary data (api-shared's `requestEnvelopeSchema`):
 * 415 unless JSON, 400 on a JSON syntax error, then the envelope's first
 * error. Attributes and relationships are validated by the caller.
 */
export async function parseResource(
  request: Request,
  {type, id}: ParseOptions
): Promise<RequestResource> {
  assertJsonMediaType(request);
  const text = await request.text();
  let document: unknown = {};
  if (text.trim() !== '') {
    try {
      document = JSON.parse(text);
    } catch (error) {
      throw parseError(MESSAGES.jsonParseError((error as Error).message));
    }
  }
  return parseOrThrow(requestEnvelopeSchema({type, id}), document);
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

interface ResourceIdentifier {
  type: string;
  id: string;
}

export interface ResourceObject extends ResourceIdentifier {
  attributes: Record<string, unknown>;
  relationships?: Record<
    string,
    | {data: ResourceIdentifier | null}
    | {data: ResourceIdentifier[]; meta: {count: number}}
  >;
}

export type ToOne<Row> = {
  type: string;
  many?: false;
  key: (row: Row) => number | null;
};

export type ToMany = {
  type: string;
  many: true;
  /** Load the related rows for these parent ids, in relationship order. */
  load: (parentIds: number[]) => Promise<unknown[]>;
  /** The parent id a loaded related row belongs to. */
  parentKey: (related: never) => number;
};

export interface ResourceDef<Row = never> {
  type: string;
  load: (ids: number[]) => Promise<Row[]>;
  attributes: (row: Row) => Record<string, unknown>;
  relationships: Record<string, ToOne<Row> | ToMany>;
  /** DJA's JSONAPIMeta.included_resources: used when `include` is absent. */
  defaultIncludes: readonly string[];
}

export type Registry = Record<string, ResourceDef<never>>;

interface Identified {
  id: number;
}

/** The registry's relationships, as api-shared's include schema walks them. */
function relationshipGraph(registry: Registry): RelationshipGraph {
  return Object.fromEntries(
    Object.entries(registry).map(([type, def]) => [
      type,
      Object.fromEntries(
        Object.entries(def.relationships).map(([name, relationship]) => [
          name,
          {type: relationship.type, many: relationship.many === true},
        ])
      ),
    ])
  );
}

/**
 * Validate the include paths (or the resource's default includes) and expand
 * them into paths plus their prefixes (`a`, `a.b`, `c`), shortest first.
 */
function resolveIncludes(
  registry: Registry,
  type: string,
  include: string | null
): string[][] {
  const root = registry[type];
  if (root === undefined) {
    throw new Error(`Unknown resource type ${type}`);
  }
  return parseOrThrow(
    includePathsSchema(relationshipGraph(registry), type),
    include === null ? [...root.defaultIncludes] : splitInclude(include)
  );
}

/**
 * Serialize rows of `type` into a JSON:API `data` + `included` pair, loading
 * whatever the include paths (or the resource's default includes) need.
 */
export async function serialize(
  registry: Registry,
  type: string,
  rows: Identified[],
  include: string | null
): Promise<{data: ResourceObject[]; included: ResourceObject[]}> {
  const store = new Map<string, Map<number, Identified>>();
  const manyLinks = new Map<string, Map<number, number[]>>();
  const includedKeys = new Set<string>();

  const bucket = (t: string) => {
    let rowsOfType = store.get(t);
    if (rowsOfType === undefined) {
      rowsOfType = new Map();
      store.set(t, rowsOfType);
    }
    return rowsOfType;
  };
  const def = (t: string): ResourceDef<never> => {
    const found = registry[t];
    if (found === undefined) {
      throw new Error(`Unknown resource type ${t}`);
    }
    return found;
  };

  for (const row of rows) {
    bucket(type).set(row.id, row);
  }

  // Load (and cache) to-many linkage for parents of `parentType`.
  const loadMany = async (
    parentType: string,
    name: string,
    relationship: ToMany,
    parentIds: number[]
  ) => {
    const cacheKey = `${parentType}.${name}`;
    let links = manyLinks.get(cacheKey);
    if (links === undefined) {
      links = new Map();
      manyLinks.set(cacheKey, links);
    }
    const missing = parentIds.filter(id => !links.has(id));
    if (missing.length > 0) {
      for (const id of missing) {
        links.set(id, []);
      }
      const related = (await relationship.load(missing)) as Identified[];
      const relatedBucket = bucket(relationship.type);
      for (const row of related) {
        relatedBucket.set(row.id, row);
        links.get(relationship.parentKey(row as never))?.push(row.id);
      }
    }
    return links;
  };

  const loadType = async (t: string, ids: number[]) => {
    const rowsOfType = bucket(t);
    const missing = [...new Set(ids)].filter(id => !rowsOfType.has(id));
    if (missing.length > 0) {
      for (const row of (await def(t).load(missing)) as Identified[]) {
        rowsOfType.set(row.id, row);
      }
    }
    return ids
      .map(id => rowsOfType.get(id))
      .filter((row): row is Identified => row !== undefined);
  };

  // Walk each include path from the primary rows, loading as we go.
  for (const path of resolveIncludes(registry, type, include)) {
    let currentType = type;
    let current: Identified[] = rows;
    for (const segment of path) {
      const relationship = def(currentType).relationships[segment];
      if (relationship === undefined) {
        throw new Error(`Unknown relationship ${currentType}.${segment}`);
      }
      let next: Identified[];
      if (relationship.many) {
        const links = await loadMany(
          currentType,
          segment,
          relationship,
          current.map(row => row.id)
        );
        const ids = current.flatMap(row => links.get(row.id) ?? []);
        next = await loadType(relationship.type, [...new Set(ids)]);
      } else {
        const ids = current
          .map(row => relationship.key(row as never))
          .filter((id): id is number => id !== null);
        // Each step walks distinct rows only, so cyclic paths stay linear.
        next = await loadType(relationship.type, [...new Set(ids)]);
      }
      for (const row of next) {
        includedKeys.add(`${relationship.type}:${row.id}`);
      }
      currentType = relationship.type;
      current = next;
    }
  }

  // Every rendered resource needs linkage for its to-many relationships.
  const renderedTypes = new Set([
    type,
    ...[...includedKeys].map(key => key.split(':')[0] as string),
  ]);
  for (const t of renderedTypes) {
    const ids = [
      ...new Set(
        [...includedKeys]
          .filter(key => key.startsWith(`${t}:`))
          .map(key => Number(key.slice(t.length + 1)))
          .concat(t === type ? rows.map(row => row.id) : [])
      ),
    ];
    for (const [name, relationship] of Object.entries(def(t).relationships)) {
      if (relationship.many) {
        await loadMany(t, name, relationship, ids);
      }
    }
  }

  const render = (t: string, row: Identified): ResourceObject => {
    const resourceDef = def(t);
    const resource: ResourceObject = {
      type: t,
      id: String(row.id),
      attributes: resourceDef.attributes(row as never),
    };
    const relationships: NonNullable<ResourceObject['relationships']> = {};
    for (const [name, relationship] of Object.entries(
      resourceDef.relationships
    )) {
      if (relationship.many) {
        const ids = manyLinks.get(`${t}.${name}`)?.get(row.id) ?? [];
        relationships[name] = {
          data: ids.map(id => ({type: relationship.type, id: String(id)})),
          meta: {count: ids.length},
        };
      } else {
        const id = relationship.key(row as never);
        relationships[name] = {
          data: id === null ? null : {type: relationship.type, id: String(id)},
        };
      }
    }
    if (Object.keys(relationships).length > 0) {
      resource.relationships = relationships;
    }
    return resource;
  };

  const primaryKeys = new Set(rows.map(row => `${type}:${row.id}`));
  // DJA renders included resources sorted by type, then by (string) id.
  const included = [...includedKeys]
    .filter(key => !primaryKeys.has(key))
    .map(key => {
      const separator = key.indexOf(':');
      return {t: key.slice(0, separator), id: key.slice(separator + 1)};
    })
    .sort((a, b) => (a.t === b.t ? (a.id < b.id ? -1 : 1) : a.t < b.t ? -1 : 1))
    .map(({t, id}) => render(t, bucket(t).get(Number(id)) as Identified));

  return {data: rows.map(row => render(type, row)), included};
}

export function document(
  data: ResourceObject | ResourceObject[] | null,
  included: ResourceObject[] = [],
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const body: Record<string, unknown> = {data};
  if (included.length > 0) {
    body['included'] = included;
  }
  return {...extra, ...body};
}

// ---------------------------------------------------------------------------
// Query parameters: validation, filters, sorting, pagination
// ---------------------------------------------------------------------------

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

export interface NumberedPagination {
  offset: number;
  links: Record<string, string | null>;
  meta: {pagination: {page: number; pages: number; count: number}};
}

/** A keyset page (`page[after]`): the page after it, when there is one. */
export interface CursorPagination {
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
