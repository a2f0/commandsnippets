/**
 * `include`: comma-separated relationship paths (`a.b,c`) naming related
 * resources to add to a document's `included`, as django-rest-framework-json-api
 * resolves them over the relationship graph.
 */
import {z} from 'zod';
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
export function includePathsSchema(graph: RelationshipGraph, type: string) {
  return z.array(z.string()).transform((requested, ctx) => {
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
          relationships === undefined ? undefined : own(relationships, segment);
        if (relationship === undefined) {
          return fail(ctx, MESSAGES.includeNotSupported(path), QUERY_ERROR);
        }
        relationships = own(graph, relationship.type);
        const prefix = segments.slice(0, index + 1);
        paths.set(prefix.join('.'), prefix);
      }
    }
    return [...paths.values()].sort((a, b) => a.length - b.length);
  });
}

/** An `include` query parameter value, resolved as `includePathsSchema`. */
export function includeSchema(graph: RelationshipGraph, type: string) {
  return z
    .string()
    .transform(splitInclude)
    .pipe(includePathsSchema(graph, type));
}
