/**
 * How the schemas describe an API error. Every validation failure is a zod
 * `custom` issue whose message is the error's `detail` and whose `params` are
 * the rest of the JSON:API error object (`ErrorMeta`). Servers turn issues
 * into error objects with `errorMeta`; clients can read the same `detail` and
 * `code` from an error response (see `errorDocumentSchema`).
 */
import {z} from 'zod';
import {CODES} from './messages';

export interface ErrorMeta {
  /** The error's `code` (DRF's error code). */
  code: string;
  /** The HTTP status, when it is not 400. */
  status?: number;
  /**
   * The error's `source.pointer`, when it is not the failing field's own
   * (a query parameter or the document as a whole, e.g. `/data`).
   */
  pointer?: string;
}

/** Query-parameter and document-level errors point at `/data`, as DRF's do. */
export const DOCUMENT_POINTER = '/data';

/** A malformed query parameter: 400 `invalid` at `/data`. */
export const QUERY_ERROR: ErrorMeta = {
  code: CODES.invalid,
  pointer: DOCUMENT_POINTER,
};

/**
 * Report a failure as a custom issue carrying `meta`. Returns `z.NEVER`, so
 * a transform can `return fail(...)`.
 */
export function fail(
  ctx: z.RefinementCtx,
  message: string,
  meta: ErrorMeta,
  path?: PropertyKey[]
): never {
  ctx.addIssue({
    code: 'custom',
    message,
    params: {...meta},
    ...(path === undefined ? {} : {path}),
  });
  return z.NEVER;
}

/** `refine` params reporting `message` with `code`, stopping at the check. */
export function check(message: string, code: string) {
  return {message, abort: true, params: {code}} as const;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The error metadata an issue carries. Issues from zod's own checks (which
 * the request schemas do not use) count as 400 `invalid`.
 */
export function errorMeta(issue: z.core.$ZodIssue): ErrorMeta {
  const params = issue.code === 'custom' ? issue.params : undefined;
  if (!isRecord(params) || typeof params['code'] !== 'string') {
    return {code: CODES.invalid};
  }
  const meta: ErrorMeta = {code: params['code']};
  if (typeof params['status'] === 'number') {
    meta.status = params['status'];
  }
  if (typeof params['pointer'] === 'string') {
    meta.pointer = params['pointer'];
  }
  return meta;
}
