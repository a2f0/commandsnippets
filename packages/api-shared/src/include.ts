/**
 * `include`: comma-separated relationship paths (`a.b,c`) naming related
 * resources to add to a document's `included`, as django-rest-framework-json-api
 * resolves them over the relationship graph.
 */
import * as z from 'zod/mini';
import {fail, QUERY_ERROR} from './issues';
import {MESSAGES} from './messages';

/** One relationship of a resource type: the related type, and whether to-many. */
export interface RelationshipDef {
  readonly type: string;
  readonly many?: boolean;
}

/** Each resource type's relationships, by name. */
export type RelationshipGraph = Readonly<
  Record<string, Readonly<Record<string, RelationshipDef>>>
>;

/**
 * The longest include path accepted. Clients use at most two segments
 * (`text_entry_to_tag.tag`); relationships are cyclic, so an unbounded path
 * could keep re-walking the same rows.
 */
export const MAX_INCLUDE_DEPTH = 3;

/** A tuple of `N` elements: a type-level counter. */
type Counter<N extends number, T extends unknown[] = []> = T['length'] extends N
  ? T
  : Counter<N, [...T, unknown]>;

/**
 * Every include path from `type` over `graph` (`a`, `a.b`, ...), at most
 * `MAX_INCLUDE_DEPTH` relationships long: what `includeSchema` accepts,
 * one path at a time.
 */
export type IncludePath<
  G extends RelationshipGraph,
  T extends keyof G,
  Depth extends unknown[] = Counter<typeof MAX_INCLUDE_DEPTH>,
> = Depth extends [unknown, ...infer Rest]
  ? {
      [K in keyof G[T] & string]:
        | K
        | `${K}.${IncludePath<G, G[T][K]['type'] & keyof G, Rest>}`;
    }[keyof G[T] & string]
  : never;

/** An own property only: `constructor` is nobody's relationship. */
function own<T>(
  record: Readonly<Record<string, T>>,
  key: string
): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

/** The paths of an `include` value, trimmed, without empty ones. */
export function splitInclude(include: string): string[] {
  return include
    .split(',')
    .map(path => path.trim())
    .filter(path => path !== '');
}

/**
 * Include paths starting at `type`, validated over `graph` (the first bad
 * path fails), and expanded into every path and prefix they name (`a`, `a.b`)
 * as segment lists, shortest first.
 */
// @__NO_SIDE_EFFECTS__
export function includePathsSchema(graph: RelationshipGraph, type: string) {
  return z.pipe(
    z.array(z.string()),
    z.transform((requested: string[], ctx) => {
      const paths = new Map<string, string[]>();
      for (const path of requested) {
        const segments = path.split('.');
        if (segments.length > MAX_INCLUDE_DEPTH) {
          return fail(
            ctx,
            MESSAGES.includeTooDeep(path, MAX_INCLUDE_DEPTH),
            QUERY_ERROR
          );
        }
        let relationships = own(graph, type);
        for (const [index, segment] of segments.entries()) {
          const relationship =
            relationships === undefined
              ? undefined
              : own(relationships, segment);
          if (relationship === undefined) {
            return fail(ctx, MESSAGES.includeNotSupported(path), QUERY_ERROR);
          }
          relationships = own(graph, relationship.type);
          const prefix = segments.slice(0, index + 1);
          paths.set(prefix.join('.'), prefix);
        }
      }
      return [...paths.values()].sort((a, b) => a.length - b.length);
    })
  );
}

/** An `include` query parameter value, resolved as `includePathsSchema`. */
// @__NO_SIDE_EFFECTS__
export function includeSchema(graph: RelationshipGraph, type: string) {
  return z.pipe(
    z.pipe(z.string(), z.transform(splitInclude)),
    includePathsSchema(graph, type)
  );
}
