/**
 * Request documents parsed as the API parses them (backend-v2's
 * `parseResource`, `validateFields` and `resolveRelated`), for the mocks'
 * write handlers: the media type, then the envelope (api-shared's
 * `requestEnvelopeSchema`, first error only), then the fields (every failing
 * field). A failure throws `MockApiError`; `errorResponse` answers with its
 * error document.
 */
import {
  CODES,
  errorMeta,
  type errorObjectSchema,
  MESSAGES,
  type RequestResource,
  requestEnvelopeSchema,
  type ToOneLinkage,
} from '@commandsnippets/api-shared';
import {HttpResponse} from 'msw';
import type {z} from 'zod';

export type ErrorObject = z.output<typeof errorObjectSchema>;

/** An API error: its status and error objects. */
export class MockApiError extends Error {
  constructor(
    readonly status: number,
    readonly errors: ErrorObject[]
  ) {
    super(errors[0]?.detail ?? `HTTP ${status}`);
  }
}

/** One error, e.g. `apiError(404, CODES.notFound, 'No Tag matches ...')`. */
export function apiError(
  status: number,
  code: string,
  detail: string,
  pointer = '/data'
): MockApiError {
  return new MockApiError(status, [
    {detail, status: String(status), source: {pointer}, code},
  ]);
}

/** `error`'s error document; anything but an API error is rethrown. */
export function errorResponse(error: unknown) {
  if (!(error instanceof MockApiError)) {
    throw error;
  }
  return HttpResponse.json({errors: error.errors}, {status: error.status});
}

/**
 * An issue as the API's error object (backend-v2's `toErrorObject`): the
 * issue's own pointer, else the failing field's under `base`, else `/data`.
 */
function toErrorObject(issue: z.core.$ZodIssue, base?: string): ErrorObject {
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

const JSON_MEDIA_TYPES = new Set([
  'application/vnd.api+json',
  'application/json',
]);

/**
 * A request document's primary data: 415 unless the body is declared JSON,
 * 400 on a JSON syntax error, then the envelope's first error (for a PATCH,
 * `id` is the endpoint's, which the document must carry).
 */
export async function parseResource<const T extends string>(
  request: Request,
  options: {type: T; id?: string}
): Promise<RequestResource<T>> {
  const mediaType =
    (request.headers.get('Content-Type') ?? '')
      .split(';', 1)[0]
      ?.trim()
      .toLowerCase() ?? '';
  if (!JSON_MEDIA_TYPES.has(mediaType)) {
    throw apiError(
      415,
      CODES.unsupportedMediaType,
      `Unsupported media type "${mediaType}" in request.`
    );
  }
  const text = await request.text();
  let document: unknown = {};
  if (text.trim() !== '') {
    try {
      document = JSON.parse(text);
    } catch (error) {
      throw apiError(
        400,
        CODES.parseError,
        MESSAGES.jsonParseError(
          error instanceof Error ? error.message : String(error)
        )
      );
    }
  }
  const result = requestEnvelopeSchema(options).safeParse(document);
  if (result.success) {
    return result.data;
  }
  const errors = result.error.issues
    .slice(0, 1)
    .map(issue => toErrorObject(issue));
  throw new MockApiError(Number(errors[0]?.status ?? 400), errors);
}

/** The validated fields, or a 400 with every failing field's error. */
export function validateFields<S extends z.ZodType>(
  schema: S,
  input: Record<string, unknown>
): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  throw new MockApiError(
    400,
    result.error.issues.map(issue => toErrorObject(issue, '/data/attributes'))
  );
}

/**
 * The id of the to-one relationship `name` (a field of the document's
 * relationships schema), when it is valid and `exists` for the requester;
 * otherwise its error is added to `errors`. Check every field before
 * answering, so that each failing one is reported.
 */
export function relatedId(
  field: z.ZodType<ToOneLinkage>,
  name: string,
  relationships: Record<string, string | null>,
  exists: (id: string) => boolean,
  errors: ErrorObject[]
): string | undefined {
  const base = '/data/relationships';
  const result = field.safeParse(relationships[name]);
  if (!result.success) {
    errors.push(
      ...result.error.issues
        .slice(0, 1)
        .map(issue =>
          toErrorObject({...issue, path: [name, ...issue.path]}, base)
        )
    );
    return undefined;
  }
  const {id} = result.data.data;
  if (!exists(id)) {
    errors.push({
      detail: MESSAGES.pkDoesNotExist(id),
      status: '400',
      source: {pointer: `${base}/${name}`},
      code: CODES.doesNotExist,
    });
    return undefined;
  }
  return id;
}
