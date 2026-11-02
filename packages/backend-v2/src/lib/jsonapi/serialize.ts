/**
 * Resource serialization with `include`, as django-rest-framework-json-api
 * rendered it: the primary rows, every row an include path reaches (each
 * loaded once), and every rendered row's relationship linkage.
 */
import {
  includePathsSchema,
  type RelationshipGraph,
  splitInclude,
} from '@commandsnippets/api-shared';
import {parseOrThrow} from '../validate';

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

/** A row a resource renders: every one has its database id. */
export interface Identified {
  id: number;
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
  load: (parentIds: number[]) => Promise<Identified[]>;
  /** The parent id a loaded related row belongs to. */
  parentKey: (related: never) => number;
};

export interface ResourceDef<Row extends Identified> {
  type: string;
  load: (ids: number[]) => Promise<Row[]>;
  attributes: (row: Row) => Record<string, unknown>;
  relationships: Record<string, ToOne<Row> | ToMany>;
  /** DJA's JSONAPIMeta.included_resources: used when `include` is absent. */
  defaultIncludes: readonly string[];
}

/**
 * A resource of any row type, as a registry holds it: its row-typed
 * functions take rows its own `load` returned, whose type the registry no
 * longer knows (so they take `never`).
 */
export interface RegisteredResource {
  type: string;
  load: (ids: number[]) => Promise<Identified[]>;
  attributes: (row: never) => Record<string, unknown>;
  relationships: Record<string, ToOne<never> | ToMany>;
  defaultIncludes: readonly string[];
}

export type Registry = Record<string, RegisteredResource>;

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

function resourceOf(registry: Registry, type: string): RegisteredResource {
  const found = registry[type];
  if (found === undefined) {
    throw new Error(`Unknown resource type ${type}`);
  }
  return found;
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
  const root = resourceOf(registry, type);
  return parseOrThrow(
    includePathsSchema(relationshipGraph(registry), type),
    include === null ? [...root.defaultIncludes] : splitInclude(include)
  );
}

/** The value of `map` at `key`, made by `make` the first time. */
function entry<K, V>(map: Map<K, V>, key: K, make: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = make();
    map.set(key, value);
  }
  return value;
}

/**
 * What one serialization loads: rows by type, to-many linkage by parent,
 * and which rows an include path reached. Each load in flight (or done) is
 * kept by what it loads for (a type, or a to-many relationship) and id, so
 * include paths walked at once wait for the same load rather than make it
 * twice.
 */
class IncludeLoader {
  private readonly rows = new Map<string, Map<number, Identified>>();
  private readonly manyLinks = new Map<string, Map<number, number[]>>();
  private readonly loads = new Map<string, Promise<void>>();
  /** The rows an include path reached, by type. */
  private readonly reached = new Map<string, Set<number>>();

  constructor(
    private readonly registry: Registry,
    private readonly type: string,
    private readonly primary: Identified[]
  ) {
    for (const row of primary) {
      this.bucket(type).set(row.id, row);
    }
  }

  private bucket(type: string): Map<number, Identified> {
    return entry(this.rows, type, () => new Map());
  }

  private def(type: string): RegisteredResource {
    return resourceOf(this.registry, type);
  }

  private async loaded(keys: string[]): Promise<void> {
    await Promise.all(keys.map(key => this.loads.get(key)));
  }

  /** Load (and cache) to-many linkage for parents of `parentType`. */
  private async loadMany(
    parentType: string,
    name: string,
    relationship: ToMany,
    parentIds: number[]
  ): Promise<Map<number, number[]>> {
    const cacheKey = `${parentType}.${name}`;
    const links = entry(this.manyLinks, cacheKey, () => new Map());
    const missing = parentIds.filter(id => !links.has(id));
    if (missing.length > 0) {
      for (const id of missing) {
        links.set(id, []);
      }
      const load = relationship.load(missing).then(related => {
        const relatedBucket = this.bucket(relationship.type);
        for (const row of related) {
          relatedBucket.set(row.id, row);
          links.get(relationship.parentKey(row as never))?.push(row.id);
        }
      });
      for (const id of missing) {
        this.loads.set(`${cacheKey}:${id}`, load);
      }
    }
    await this.loaded(parentIds.map(id => `${cacheKey}:${id}`));
    return links;
  }

  private async loadType(type: string, ids: number[]): Promise<Identified[]> {
    const rowsOfType = this.bucket(type);
    const missing = [...new Set(ids)].filter(
      id => !rowsOfType.has(id) && !this.loads.has(`${type}:${id}`)
    );
    if (missing.length > 0) {
      const load = this.def(type)
        .load(missing)
        .then(found => {
          for (const row of found) {
            rowsOfType.set(row.id, row);
          }
        });
      for (const id of missing) {
        this.loads.set(`${type}:${id}`, load);
      }
    }
    await this.loaded(ids.map(id => `${type}:${id}`));
    return ids
      .map(id => rowsOfType.get(id))
      .filter((row): row is Identified => row !== undefined);
  }

  /** Walk an include path from the primary rows, loading as it goes. */
  async walk(path: string[]): Promise<void> {
    let currentType = this.type;
    let current = this.primary;
    for (const segment of path) {
      const relationship = this.def(currentType).relationships[segment];
      if (relationship === undefined) {
        throw new Error(`Unknown relationship ${currentType}.${segment}`);
      }
      let ids: number[];
      if (relationship.many) {
        const links = await this.loadMany(
          currentType,
          segment,
          relationship,
          current.map(row => row.id)
        );
        ids = current.flatMap(row => links.get(row.id) ?? []);
      } else {
        ids = current
          .map(row => relationship.key(row as never))
          .filter((id): id is number => id !== null);
      }
      // Each step walks distinct rows only, so cyclic paths stay linear.
      const next = await this.loadType(relationship.type, [...new Set(ids)]);
      const reached = entry(this.reached, relationship.type, () => new Set());
      for (const row of next) {
        reached.add(row.id);
      }
      currentType = relationship.type;
      current = next;
    }
  }

  /**
   * Every rendered resource needs linkage for its to-many relationships:
   * load what the walks did not, all at once.
   */
  async loadLinkage(): Promise<void> {
    const rendered = new Map(this.reached);
    rendered.set(
      this.type,
      new Set([
        ...(this.reached.get(this.type) ?? []),
        ...this.primary.map(row => row.id),
      ])
    );
    await Promise.all(
      [...rendered].flatMap(([type, ids]) =>
        Object.entries(this.def(type).relationships).map(
          ([name, relationship]) =>
            relationship.many
              ? this.loadMany(type, name, relationship, [...ids])
              : undefined
        )
      )
    );
  }

  render(type: string, row: Identified): ResourceObject {
    const def = this.def(type);
    const resource: ResourceObject = {
      type,
      id: String(row.id),
      attributes: def.attributes(row as never),
    };
    const relationships: NonNullable<ResourceObject['relationships']> = {};
    for (const [name, relationship] of Object.entries(def.relationships)) {
      if (relationship.many) {
        const ids = this.manyLinks.get(`${type}.${name}`)?.get(row.id) ?? [];
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
  }

  /**
   * The reached rows that are not primary, rendered: sorted by type, then
   * by (string) id, as DJA renders them.
   */
  included(): ResourceObject[] {
    const primary = new Set(this.primary.map(row => row.id));
    return [...this.reached.keys()].sort().flatMap(type => {
      const rowsOfType = this.bucket(type);
      return [...(this.reached.get(type) ?? [])]
        .filter(id => type !== this.type || !primary.has(id))
        .map(String)
        .sort()
        .flatMap(id => {
          const row = rowsOfType.get(Number(id));
          return row === undefined ? [] : [this.render(type, row)];
        });
    });
  }
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
  const paths = resolveIncludes(registry, type, include);
  const loader = new IncludeLoader(registry, type, rows);
  // Paths come shortest first, after their prefixes (`a` before `a.b`),
  // whose loads a longer path finds done: so the paths of each length are
  // walked at once, their loads in parallel.
  for (const length of new Set(paths.map(path => path.length))) {
    await Promise.all(
      paths
        .filter(path => path.length === length)
        .map(path => loader.walk(path))
    );
  }
  await loader.loadLinkage();
  return {
    data: rows.map(row => loader.render(type, row)),
    included: loader.included(),
  };
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
