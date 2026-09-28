/**
 * Request documents: `{data: {type, id?, attributes?, relationships?}}`,
 * checked as django-rest-framework-json-api's parser checked them. The
 * envelope fails at its first error, in this order: no primary data (400),
 * the wrong type (409), a missing (400) or different (409) id where the
 * endpoint has one, then the first relationship whose linkage is malformed
 * (400). Attributes and relationships are then validated as serializer
 * fields, every failing field reported.
 */
import {z} from 'zod';
import {DOCUMENT_POINTER, type ErrorMeta, fail} from '../issues';
import {CODES, MESSAGES} from '../messages';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const PARSE_ERROR: ErrorMeta = {
  code: CODES.parseError,
  pointer: DOCUMENT_POINTER,
};
const CONFLICT: ErrorMeta = {
  code: CODES.conflict,
  status: 409,
  pointer: DOCUMENT_POINTER,
};

/** A request document's primary data, as the envelope normalizes it. */
export interface RequestResource<T extends string = string> {
  type: T;
  /** `data.id` as a string (whatever its JSON type), when present. */
  id: string | undefined;
  /** `data.attributes`, or `{}` when it is not an object. */
  attributes: Record<string, unknown>;
  /**
   * Each relationship's linkage: the related id as a string, or null.
   * `{}` when `data.relationships` is not an object.
   */
  relationships: Record<string, string | null>;
}

export interface EnvelopeOptions<T extends string> {
  /** The resource type the endpoint accepts (DJA's `resource_name`). */
  type: T;
  /** The endpoint's id (PATCH/PUT): the document must carry the same one. */
  id?: string | undefined;
  /** Require `data.id` without an endpoint id to compare it to. */
  requireId?: boolean;
}

/**
 * The envelope of a request document (see the module comment), for an
 * endpoint that accepts `type` (and, for PATCH/PUT, has `id`).
 */
export function requestEnvelopeSchema<const T extends string>({
  type,
  id: endpointId,
  requireId = false,
}: EnvelopeOptions<T>): z.ZodType<RequestResource<T>, unknown> {
  return z.unknown().transform((document, ctx): RequestResource<T> => {
    const data = isRecord(document) ? document['data'] : undefined;
    if (!isRecord(data)) {
      return fail(ctx, MESSAGES.noPrimaryData, PARSE_ERROR);
    }
    if (data['type'] !== type) {
      return fail(
        ctx,
        MESSAGES.typeMismatch(String(data['type']), type),
        CONFLICT
      );
    }
    const id = data['id'] === undefined ? undefined : String(data['id']);
    if (id === undefined && (endpointId !== undefined || requireId)) {
      return fail(ctx, MESSAGES.idMissing, PARSE_ERROR);
    }
    if (endpointId !== undefined && id !== endpointId) {
      return fail(ctx, MESSAGES.idMismatch(String(id), endpointId), CONFLICT);
    }
    // Resource linkage, `{data: {id}}` or `{data: null}`, for every
    // relationship, whether the endpoint uses it or not.
    const relationships: Array<[string, string | null]> = [];
    const members = isRecord(data['relationships'])
      ? data['relationships']
      : {};
    for (const [name, member] of Object.entries(members)) {
      const linkage = isRecord(member) ? member['data'] : undefined;
      if (linkage === null) {
        relationships.push([name, null]);
      } else if (isRecord(linkage) && linkage['id'] !== undefined) {
        relationships.push([name, String(linkage['id'])]);
      } else {
        return fail(ctx, MESSAGES.invalidLinkage, {
          code: CODES.invalid,
          pointer: `/data/relationships/${name}`,
        });
      }
    }
    return {
      type,
      id,
      attributes: isRecord(data['attributes']) ? data['attributes'] : {},
      relationships: Object.fromEntries(relationships),
    };
  });
}

/**
 * Attribute or relationship fields: an object of `fields.ts` fields. Their
 * input is the envelope's `attributes`, or its normalized `relationships`.
 */
export type FieldsSchema = z.ZodType<object>;

/** No attributes (or relationships): any given are ignored. */
export const noFieldsSchema = z.object({});

/** A member that may be left out when all its fields may (`attributes`). */
type Member<K extends string, V> =
  Record<never, never> extends V ? {[P in K]?: V} : {[P in K]: V};

/**
 * A request document as clients write it, and as the document schemas output
 * it: normalized attribute values, relationships as `{data: {type, id}}`.
 */
export type RequestDocument<
  T extends string,
  A extends object,
  R extends object,
  Id extends boolean = false,
> = {
  data: {type: T} & (Id extends true ? {id: string} : unknown) &
    Member<'attributes', A> &
    Member<'relationships', R>;
};

/** Report the issues of a nested parse under `path`. */
function forward(
  ctx: z.RefinementCtx,
  issues: readonly z.core.$ZodIssue[],
  path: PropertyKey[]
): void {
  for (const issue of issues) {
    ctx.addIssue({...issue, path: [...path, ...issue.path]});
  }
}

function documentSchema<
  T extends string,
  A extends FieldsSchema,
  R extends FieldsSchema,
  Id extends boolean,
>(
  type: T,
  parts: {attributes: A; relationships: R},
  requireId: Id
): z.ZodType<RequestDocument<T, z.output<A>, z.output<R>, Id>, unknown> {
  type Document = RequestDocument<T, z.output<A>, z.output<R>, Id>;
  return requestEnvelopeSchema({type, requireId}).transform(
    (resource, ctx): Document => {
      const attributes = parts.attributes.safeParse(resource.attributes);
      const relationships = parts.relationships.safeParse(
        resource.relationships
      );
      if (!(attributes.success && relationships.success)) {
        forward(ctx, attributes.error?.issues ?? [], ['data', 'attributes']);
        forward(ctx, relationships.error?.issues ?? [], [
          'data',
          'relationships',
        ]);
        return z.NEVER;
      }
      return {
        data: {
          type,
          ...(requireId ? {id: resource.id} : {}),
          attributes: attributes.data,
          relationships: relationships.data,
        },
      } as Document;
    }
  );
}

/** A POST document of `type`: validates the envelope, then the fields. */
export function createDocumentSchema<
  const T extends string,
  A extends FieldsSchema,
  R extends FieldsSchema,
>(type: T, parts: {attributes: A; relationships: R}) {
  return documentSchema(type, parts, false);
}

/**
 * A PATCH/PUT document of `type`: as `createDocumentSchema`, with a required
 * `data.id` (servers also compare it to the endpoint's id).
 */
export function updateDocumentSchema<
  const T extends string,
  A extends FieldsSchema,
  R extends FieldsSchema,
>(type: T, parts: {attributes: A; relationships: R}) {
  return documentSchema(type, parts, true);
}
