/**
 * DRF-style API exceptions rendered in the JSON:API error format produced by
 * `rest_framework_json_api.exceptions.exception_handler` (api-shared's
 * `errorDocumentSchema`, with its `CODES`).
 */
import {CODES} from '@commandsnippets/api-shared';

export interface ErrorObject {
  detail: string;
  status: string;
  source?: {pointer: string};
  code?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errors: ErrorObject[];

  constructor(status: number, errors: ErrorObject[]) {
    super(errors[0]?.detail ?? `HTTP ${status}`);
    this.status = status;
    this.errors = errors;
  }

  static of(
    status: number,
    detail: string,
    code: string,
    pointer = '/data'
  ): ApiError {
    return new ApiError(status, [
      {detail, status: String(status), source: {pointer}, code},
    ]);
  }
}

export const notAuthenticated = () =>
  ApiError.of(
    403,
    'Authentication credentials were not provided.',
    CODES.notAuthenticated
  );

export const permissionDenied = () =>
  ApiError.of(
    403,
    'You do not have permission to perform this action.',
    CODES.permissionDenied
  );

/** e.g. notFound('No Tag matches the given query.') or 'Invalid page.' */
export const notFound = (detail: string) =>
  ApiError.of(404, detail, CODES.notFound);

export const methodNotAllowed = (method: string) =>
  ApiError.of(405, `Method "${method}" not allowed.`, CODES.methodNotAllowed);

export const parseError = (detail: string) =>
  ApiError.of(400, detail, CODES.parseError);

/**
 * DRF's AuthenticationFailed. DRF coerces it to 403 when there is no
 * WWW-Authenticate header, which was the case for this API.
 */
export const authenticationFailed = (detail: string) =>
  ApiError.of(403, detail, CODES.authenticationFailed);

/** A state-changing request from an origin outside the CORS allowlist. */
export const originNotAllowed = () =>
  ApiError.of(403, 'Origin not allowed.', CODES.originNotAllowed);

export const userMismatch = () =>
  ApiError.of(
    409,
    'The request is not signed in as the user it names.',
    CODES.userMismatch
  );

export const unsupportedMediaType = (mediaType: string | undefined) =>
  ApiError.of(
    415,
    `Unsupported media type "${mediaType}" in request.`,
    CODES.unsupportedMediaType
  );

/**
 * A request naming a data version (`DATA_VERSION_HEADER`) that is not the
 * user's active one, or a write landing after a switch: the client clears
 * its copy of the data and syncs it again.
 */
export const dataVersionChanged = () =>
  ApiError.of(
    409,
    'The data version changed. Sync the data again.',
    CODES.dataVersionChanged
  );

/** DRF's ValidationError on the document as a whole. */
export const validationError = (detail: string) =>
  ApiError.of(400, detail, CODES.invalid);

/** DRF's UniqueTogetherValidator, e.g. `uniqueTogether('name', 'user')`. */
export const uniqueTogether = (...fields: string[]) =>
  ApiError.of(
    400,
    `The fields ${fields.join(', ')} must make a unique set.`,
    CODES.unique
  );

/** A single attribute's validation error, beyond what its schema checks. */
export const fieldError = (field: string, detail: string, code: string) =>
  ApiError.of(400, detail, code, `/data/attributes/${field}`);

/**
 * A loggable one-line summary of an unexpected error, with SQL parameters
 * redacted: Drizzle's query errors embed every bound value in their message,
 * and those include auth token keys. The stack is left out for the same
 * reason (it repeats the message).
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return `Non-Error thrown: ${typeof error}`;
  }
  const message = error.message.replace(
    /\nparams: [\s\S]*$/,
    '\nparams: [redacted]'
  );
  const cause =
    error.cause instanceof Error
      ? ` (cause: ${error.cause.name}: ${error.cause.message})`
      : '';
  return `${error.name}: ${message}${cause}`;
}
