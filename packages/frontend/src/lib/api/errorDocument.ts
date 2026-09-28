/**
 * What the client reads from an error response: the `code` and `detail` of
 * the first error in a JSON:API error document (api-shared's
 * `errorDocumentSchema`). Branch on the code (`CODES`), never on the detail.
 */
import {errorObjectSchema} from '@commandsnippets/api-shared';
import {z} from 'zod';

/** A member read with the contract's schema for it, or undefined. */
const member = <T>(schema: z.ZodType<T>) => schema.optional().catch(undefined);

/**
 * The first error's `code` and `detail`, each read on its own: one that is
 * missing or not the contract's type reads as undefined, and nothing else in
 * the body matters. Decisions rest on the code alone (whether the session is
 * gone, whether the user is not staff), so a document that breaks the
 * contract elsewhere (a later error, a missing `status`) must not change
 * them; a body that is not an error document at all has no code.
 */
const firstErrorSchema = z.object({
  errors: z.tuple(
    [
      z.object({
        code: member(errorObjectSchema.shape.code),
        detail: member(errorObjectSchema.shape.detail),
      }),
    ],
    z.unknown()
  ),
});

export interface FirstError {
  code: string | undefined;
  detail: string | undefined;
}

/** The first error of an error response's body (see `firstErrorSchema`). */
export function firstError(body: unknown): FirstError {
  const result = firstErrorSchema.safeParse(body);
  const error = result.success ? result.data.errors[0] : undefined;
  return {code: error?.code, detail: error?.detail};
}
