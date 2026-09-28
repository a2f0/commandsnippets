/**
 * The adapter from api-shared's zod schemas to the API's errors: each issue
 * becomes a JSON:API error object, its message the `detail`, its metadata
 * (`errorMeta`) the `code`, status and pointer. Validation keeps DRF's two
 * behaviors: documents and query parameters fail at their first error;
 * serializer fields report every failing field (one error each, in field
 * order, which is the schema's key order).
 */
import {errorMeta} from '@commandsnippets/api-shared';
import {en} from 'zod/locales';
import * as z from 'zod/mini';
import {ApiError, type ErrorObject} from './errors';

// api-shared's schemas are zod/mini, which loads no locale: zod's own
// messages (from checks the request schemas do not use, so never sent so far)
// would all read `Invalid input`. English keeps them as classic zod wrote them.
z.config(en());

/**
 * An issue as an error object. The pointer is the issue's own, else the
 * failing field's under `base` (e.g. `/data/attributes/name`), else `/data`.
 */
export function toErrorObject(
  issue: z.core.$ZodIssue,
  base?: string
): ErrorObject {
  const {code, status = 400, pointer} = errorMeta(issue);
  return {
    detail: issue.message,
    status: String(status),
    source: {
      pointer:
        pointer ??
        (base === undefined
          ? '/data'
          : [base, ...issue.path.map(String)].join('/')),
    },
    code,
  };
}

/** Parse `input`, or throw its first error (DRF raises at the first check). */
export function parseOrThrow<S extends z.ZodMiniType>(
  schema: S,
  input: z.input<S>
): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  const error = toErrorObject(result.error.issues[0] as z.core.$ZodIssue);
  throw new ApiError(Number(error.status), [error]);
}

/**
 * `Serializer(data=input).is_valid(raise_exception=True)`: the validated
 * fields, or a 400 with every failing field's error, pointing under `base`.
 */
export function validateFields<S extends z.ZodMiniType>(
  schema: S,
  input: Record<string, unknown>,
  base = '/data/attributes'
): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  throw new ApiError(
    400,
    result.error.issues.map(issue => toErrorObject(issue, base))
  );
}

/** One field's outcome, when fields are validated one at a time. */
export type FieldResult<Shape extends Record<string, z.ZodMiniType>> = {
  [K in keyof Shape & string]:
    | {name: K; value: z.output<Shape[K]>}
    | {name: K; error: ErrorObject};
}[keyof Shape & string];

/**
 * Validate each field of `schema` on its own, in field order, so a caller
 * can go on to check the valid ones (e.g. that a pk exists) and still report
 * every field's error together, as DRF does.
 */
export function eachField<Shape extends Record<string, z.ZodMiniType>>(
  schema: z.ZodMiniObject<Shape>,
  input: Record<string, unknown>,
  base: string
): Array<FieldResult<Shape>> {
  return Object.entries(schema.shape).map(([name, field]) => {
    const result = field.safeParse(input[name]);
    if (result.success) {
      return {name, value: result.data} as FieldResult<Shape>;
    }
    const [issue] = result.error.issues as [z.core.$ZodIssue];
    return {
      name,
      error: toErrorObject({...issue, path: [name, ...issue.path]}, base),
    } as FieldResult<Shape>;
  });
}
