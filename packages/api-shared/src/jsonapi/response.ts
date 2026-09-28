/**
 * Response documents, as the API renders them: resource objects with their
 * relationships' linkage, single and list documents (`included`, and DJA's
 * pagination `links` and `meta`), and the error document.
 *
 * The schemas mirror the output exactly and transform nothing, so a parsed
 * document equals the one received (unknown members are dropped).
 */
import * as z from 'zod/mini';
import type {RelationshipDef} from '../include';

/** Resource ids are database ids, rendered as strings. */
export const resourceIdSchema = z.string().check(z.regex(/^\d+$/));

/**
 * A rendered timestamp: naive UTC, `YYYY-MM-DDTHH:MM:SS[.ffffff]` (Python's
 * `isoformat()`: no fraction when the microseconds are zero).
 */
export const timestampSchema = z
  .string()
  .check(z.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{6})?$/));

/** A count or a rank: a non-negative integer. */
export const countSchema = z.number().check(z.int(), z.nonnegative());

export function resourceIdentifierSchema<const T extends string>(type: T) {
  return z.object({type: z.literal(type), id: resourceIdSchema});
}

/** A to-one relationship: `{data: {type, id}}`. */
export function toOneSchema<const T extends string>(type: T) {
  return z.object({data: resourceIdentifierSchema(type)});
}

/** A to-many relationship: every related identifier, and their count. */
export function toManySchema<const T extends string>(type: T) {
  return z.object({
    data: z.array(resourceIdentifierSchema(type)),
    meta: z.object({count: countSchema}),
  });
}

type RelationshipSchema<D extends RelationshipDef> = D extends {
  many: true;
}
  ? ReturnType<typeof toManySchema<D['type']>>
  : ReturnType<typeof toOneSchema<D['type']>>;

/** The relationships object of a resource with relationships `defs`. */
export function relationshipsSchema<
  const D extends Readonly<Record<string, RelationshipDef>>,
>(defs: D) {
  const shape = Object.fromEntries(
    Object.entries(defs).map(([name, def]) => [
      name,
      def.many === true ? toManySchema(def.type) : toOneSchema(def.type),
    ])
  );
  // Object.fromEntries loses the names' types; the mapped type restores them.
  return z.object(shape) as unknown as z.ZodMiniObject<{
    -readonly [K in keyof D]: RelationshipSchema<D[K]>;
  }>;
}

/** A resource object without relationships (they are omitted when none). */
export function resourceSchema<
  const T extends string,
  A extends z.ZodMiniObject,
>(type: T, attributes: A) {
  return z.object({type: z.literal(type), id: resourceIdSchema, attributes});
}

/** A resource object with its relationships' linkage. */
export function relatedResourceSchema<
  const T extends string,
  A extends z.ZodMiniObject,
  R extends z.ZodMiniObject,
>(type: T, attributes: A, relationships: R) {
  return z.object({
    type: z.literal(type),
    id: resourceIdSchema,
    attributes,
    relationships,
  });
}

/** `included`: resources of `included`'s schema, left out rather than empty. */
function includedSchema<I extends z.ZodMiniType>(included: I) {
  return z.optional(z.array(included).check(z.minLength(1)));
}

/**
 * A single-resource document. `included` is the schema of the resources an
 * include can add (`z.never()` where none can); the member is omitted when
 * it would be empty.
 */
export function documentSchema<
  D extends z.ZodMiniType,
  I extends z.ZodMiniType,
>(data: D, included: I) {
  return z.object({data, included: includedSchema(included)});
}

/** DJA's page-number pagination links: absolute URLs, or null. */
export const paginationLinksSchema = z.object({
  first: z.url(),
  last: z.url(),
  next: z.nullable(z.url()),
  prev: z.nullable(z.url()),
});

export const paginationMetaSchema = z.object({
  pagination: z.object({
    page: z.number().check(z.int(), z.positive()),
    pages: z.number().check(z.int(), z.positive()),
    count: countSchema,
  }),
});

/** A page of a collection (see `documentSchema` for `included`). */
export function listDocumentSchema<
  D extends z.ZodMiniType,
  I extends z.ZodMiniType,
>(data: D, included: I) {
  return z.object({
    links: paginationLinksSchema,
    meta: paginationMetaSchema,
    data: z.array(data),
    included: includedSchema(included),
  });
}

/** One error of an error document (DRF-JSON:API's exception handler). */
export const errorObjectSchema = z.object({
  detail: z.string(),
  status: z.string().check(z.regex(/^[45]\d\d$/)),
  source: z.optional(z.object({pointer: z.string()})),
  code: z.string(),
});

/**
 * An error response. Its `errors` are empty only for the 401s of an expired
 * session (`GET /api/v1/user`) or a failed OAuth exchange.
 */
export const errorDocumentSchema = z.object({
  errors: z.array(errorObjectSchema),
});

/** The body of a login or logout: `{}`. */
export const emptyObjectSchema = z.strictObject({});
