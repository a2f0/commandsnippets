/**
 * Response documents, as the API renders them: resource objects with their
 * relationships' linkage, single and list documents (`included`, and DJA's
 * pagination `links` and `meta`), and the error document.
 *
 * The schemas mirror the output exactly and transform nothing, so a parsed
 * document equals the one received (unknown members are dropped).
 */
import {z} from 'zod';
import type {RelationshipDef} from '../include';

/** Resource ids are database ids, rendered as strings. */
export const resourceIdSchema = z.string().regex(/^\d+$/);

/**
 * A rendered timestamp: naive UTC, `YYYY-MM-DDTHH:MM:SS[.ffffff]` (Python's
 * `isoformat()`: no fraction when the microseconds are zero).
 */
export const timestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{6})?$/);

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
    meta: z.object({count: z.number().int().nonnegative()}),
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
  return z.object(shape) as unknown as z.ZodObject<{
    -readonly [K in keyof D]: RelationshipSchema<D[K]>;
  }>;
}

/** A resource object without relationships (they are omitted when none). */
export function resourceSchema<const T extends string, A extends z.ZodObject>(
  type: T,
  attributes: A
) {
  return z.object({type: z.literal(type), id: resourceIdSchema, attributes});
}

/** A resource object with its relationships' linkage. */
export function relatedResourceSchema<
  const T extends string,
  A extends z.ZodObject,
  R extends z.ZodObject,
>(type: T, attributes: A, relationships: R) {
  return z.object({
    type: z.literal(type),
    id: resourceIdSchema,
    attributes,
    relationships,
  });
}

/**
 * A single-resource document. `included` is the schema of the resources an
 * include can add (`z.never()` where none can); the member is omitted when
 * it would be empty.
 */
export function documentSchema<D extends z.ZodType, I extends z.ZodType>(
  data: D,
  included: I
) {
  return z.object({data, included: z.array(included).min(1).optional()});
}

/** DJA's page-number pagination links: absolute URLs, or null. */
export const paginationLinksSchema = z.object({
  first: z.url(),
  last: z.url(),
  next: z.url().nullable(),
  prev: z.url().nullable(),
});

export const paginationMetaSchema = z.object({
  pagination: z.object({
    page: z.number().int().positive(),
    pages: z.number().int().positive(),
    count: z.number().int().nonnegative(),
  }),
});

/** A page of a collection (see `documentSchema` for `included`). */
export function listDocumentSchema<D extends z.ZodType, I extends z.ZodType>(
  data: D,
  included: I
) {
  return z.object({
    links: paginationLinksSchema,
    meta: paginationMetaSchema,
    data: z.array(data),
    included: z.array(included).min(1).optional(),
  });
}

/** One error of an error document (DRF-JSON:API's exception handler). */
export const errorObjectSchema = z.object({
  detail: z.string(),
  status: z.string().regex(/^[45]\d\d$/),
  source: z.object({pointer: z.string()}).optional(),
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
