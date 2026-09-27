/**
 * DRF-style API exceptions rendered in the JSON:API error format produced by
 * `rest_framework_json_api.exceptions.exception_handler`.
 */

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
    'not_authenticated'
  );

export const permissionDenied = () =>
  ApiError.of(
    403,
    'You do not have permission to perform this action.',
    'permission_denied'
  );

/** e.g. notFound('No Tag matches the given query.') or 'Invalid page.' */
export const notFound = (detail: string) =>
  ApiError.of(404, detail, 'not_found');

export const methodNotAllowed = (method: string) =>
  ApiError.of(405, `Method "${method}" not allowed.`, 'method_not_allowed');

export const parseError = (detail: string) =>
  ApiError.of(400, detail, 'parse_error');

export const conflict = (detail: string) => ApiError.of(409, detail, 'error');

/** A single-field validation error, e.g. max_length on `name`. */
export const fieldError = (
  field: string,
  detail: string,
  code: string,
  kind: 'attributes' | 'relationships' = 'attributes'
) => ApiError.of(400, detail, code, `/data/${kind}/${field}`);

/** A query-parameter validation error, e.g. `invalid filter[bad]`. */
export const queryError = (detail: string) =>
  ApiError.of(400, detail, 'invalid');
