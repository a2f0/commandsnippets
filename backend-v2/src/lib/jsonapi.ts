/**
 * A small port of the parts of django-rest-framework-json-api this API used:
 * request document parsing, resource serialization with `include`, and the
 * query-parameter/filter/sort/pagination conventions (including their error
 * messages, which clients and tests rely on).
 */
import {desc, type SQL} from 'drizzle-orm';
import {
  ApiError,
  conflict,
  fieldError,
  notFound,
  parseError,
  queryError,
} from './errors';

// ---------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------

export interface ParsedResource {
  id: string | undefined;
  attributes: Record<string, unknown>;
  relationships: Record<string, string | null>;
}

interface ParseOptions {
  /** The resource type the endpoint accepts (DJA's resource_name). */
  type: string;
  /** For PATCH/PUT: the id from the URL, which the document must match. */
  id?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Request bodies must be JSON. Both accepted types make a cross-origin request
 * "non-simple", so the browser preflights it and the CORS allowlist applies;
 * `text/plain` or form posts would otherwise skip the preflight (login CSRF).
 * DRF-JSON:API likewise answered other media types with 415.
 */
const JSON_MEDIA_TYPES = new Set([
  'application/vnd.api+json',
  'application/json',
]);

export async function parseResource(
  request: Request,
  {type, id}: ParseOptions
): Promise<ParsedResource> {
  const mediaType = (request.headers.get('Content-Type') ?? '')
    .split(';', 1)[0]
    ?.trim()
    .toLowerCase();
  if (!JSON_MEDIA_TYPES.has(mediaType ?? '')) {
    throw ApiError.of(
      415,
      `Unsupported media type "${mediaType}" in request.`,
      'unsupported_media_type'
    );
  }
  const text = await request.text();
  let document: unknown = {};
  if (text.trim() !== '') {
    try {
      document = JSON.parse(text);
    } catch (error) {
      throw parseError(`JSON parse error - ${(error as Error).message}`);
    }
  }
  const data = isRecord(document) ? document['data'] : undefined;
  if (!isRecord(data)) {
    throw parseError('Received document does not contain primary data');
  }
  if (data['type'] !== type) {
    throw conflict(
      `The resource object's type (${String(data['type'])}) is not the type ` +
        `that constitute the collection represented by the endpoint (${type}).`
    );
  }
  const dataId = data['id'] === undefined ? undefined : String(data['id']);
  if (id !== undefined) {
    if (dataId === undefined) {
      throw parseError(
        "The resource identifier object must contain an 'id' member"
      );
    }
    if (dataId !== id) {
      throw conflict(
        `The resource object's id (${dataId}) does not match the endpoint's id (${id}).`
      );
    }
  }

  const relationships: Record<string, string | null> = {};
  const rawRelationships = isRecord(data['relationships'])
    ? data['relationships']
    : {};
  for (const [name, value] of Object.entries(rawRelationships)) {
    const linkage = isRecord(value) ? value['data'] : undefined;
    if (linkage === null) {
      relationships[name] = null;
    } else if (isRecord(linkage) && linkage['id'] !== undefined) {
      relationships[name] = String(linkage['id']);
    } else {
      throw fieldError(
        name,
        'Received data is not a valid JSONAPI Resource Identifier Object',
        'invalid',
        'relationships'
      );
    }
  }

  return {
    id: dataId,
    attributes: isRecord(data['attributes']) ? data['attributes'] : {},
    relationships,
  };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export interface ResourceIdentifier {
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

type ToOne<Row> = {
  type: string;
  many?: false;
  key: (row: Row) => number | null;
};

type ToMany = {
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
  defaultIncludes: string[];
}

export type Registry = Record<string, ResourceDef<never>>;

interface Identified {
  id: number;
}

/** Expand `a.b,c` into validated paths plus their prefixes (`a`, `a.b`, `c`). */
function resolveIncludes(
  registry: Registry,
  type: string,
  include: string | null
): string[][] {
  const root = registry[type];
  if (root === undefined) {
    throw new Error(`Unknown resource type ${type}`);
  }
  const requested =
    include === null
      ? root.defaultIncludes
      : include
          .split(',')
          .map(path => path.trim())
          .filter(path => path !== '');
  const paths = new Map<string, string[]>();
  for (const path of requested) {
    const segments = path.split('.');
    let def: ResourceDef<never> | undefined = root;
    segments.forEach((segment, index) => {
      const relationship = def?.relationships[segment];
      if (relationship === undefined) {
        throw queryError(
          `This endpoint does not support the include parameter for path ${path}`
        );
      }
      def = registry[relationship.type];
      const prefix = segments.slice(0, index + 1);
      paths.set(prefix.join('.'), prefix);
    });
  }
  return [...paths.values()].sort((a, b) => a.length - b.length);
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
        next = await loadType(relationship.type, ids);
      } else {
        const ids = current
          .map(row => relationship.key(row as never))
          .filter((id): id is number => id !== null);
        next = await loadType(relationship.type, ids);
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

const QUERY_PARAM =
  /^(sort|include)$|^(?<kind>filter|fields|page)(\[[\w.-]+\])?$/;
const FILTER_PARAM = /^filter\[([\w.-]+)\]$/;

export const SEARCH_PARAM = 'filter[search]';
export const PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/** Maps a Django filter key (e.g. `date_updated__gt`) to a SQL condition. */
export type FilterSpec = Record<string, (value: string) => SQL>;

/** Maps a sortable field name to the SQL expression to order by. */
export type OrderingSpec = Record<string, SQL>;

export interface ListQuery {
  filters: SQL[];
  search: string | null;
  orderBy: SQL[] | null;
  page: number;
  pageSize: number;
  include: string | null;
}

export function parseListQuery(
  url: URL,
  filterSpec: FilterSpec,
  orderingSpec: OrderingSpec
): ListQuery {
  const params = url.searchParams;
  for (const key of new Set(params.keys())) {
    const match = QUERY_PARAM.exec(key);
    if (!match) {
      throw queryError(`invalid query parameter: ${key}`);
    }
    if (match.groups?.['kind'] !== 'filter' && params.getAll(key).length > 1) {
      throw queryError(`repeated query parameter not allowed: ${key}`);
    }
  }

  const filters: SQL[] = [];
  for (const key of new Set(params.keys())) {
    // Keys were validated above, so this only matches well-formed filters.
    const assoc = FILTER_PARAM.exec(key)?.[1];
    if (assoc === undefined || key === SEARCH_PARAM) {
      continue;
    }
    const values = params.getAll(key);
    if (values.some(value => value === '')) {
      throw queryError(`missing value for query parameter ${key}`);
    }
    const filterKey = assoc.replaceAll('.', '__');
    const filter = filterSpec[filterKey];
    if (filter === undefined) {
      throw queryError(`invalid filter[${filterKey}]`);
    }
    for (const value of values) {
      filters.push(filter(value));
    }
  }

  let orderBy: SQL[] | null = null;
  const sort = params.get('sort');
  if (sort !== null && sort !== '') {
    const terms = sort.split(',').map(term => term.trim());
    const bad = terms.filter(
      term => !(term.replaceAll('.', '__').replace(/^-/, '') in orderingSpec)
    );
    if (bad.length > 0) {
      throw queryError(
        `invalid sort parameter${bad.length > 1 ? 's' : ''}: ${bad.join(',')}`
      );
    }
    orderBy = terms.map(term => {
      const field = orderingSpec[term.replace(/^-/, '')] as SQL;
      return term.startsWith('-') ? desc(field) : field;
    });
  }

  const positiveInt = (value: string | null) =>
    value !== null && /^\d+$/.test(value) && Number(value) > 0
      ? Number(value)
      : null;
  const page = params.has('page[number]')
    ? positiveInt(params.get('page[number]'))
    : 1;
  if (page === null) {
    throw notFound('Invalid page.');
  }
  const pageSize = Math.min(
    positiveInt(params.get('page[size]')) ?? PAGE_SIZE,
    MAX_PAGE_SIZE
  );

  return {
    filters,
    search: params.get(SEARCH_PARAM),
    orderBy,
    page,
    pageSize,
    include: params.get('include'),
  };
}

export interface Pagination {
  offset: number;
  links: Record<string, string | null>;
  meta: {pagination: {page: number; pages: number; count: number}};
}

/** Page-number pagination with DJA's links/meta shape. */
export function paginate(
  url: URL,
  query: ListQuery,
  count: number
): Pagination {
  const pages = Math.max(1, Math.ceil(count / query.pageSize));
  if (query.page > pages) {
    throw notFound('Invalid page.');
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
