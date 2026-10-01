/**
 * The API's error codes and validation messages. They reproduce Django REST
 * framework's (and django-rest-framework-json-api's and django-filter's)
 * wording byte for byte: clients and tests match on them, so changing one is
 * a change to the public API.
 */

/** The `code` member of a JSON:API error object (DRF's error codes). */
export const CODES = {
  // Serializer fields.
  required: 'required',
  null: 'null',
  blank: 'blank',
  invalid: 'invalid',
  maxLength: 'max_length',
  readOnly: 'read_only',
  incorrectType: 'incorrect_type',
  doesNotExist: 'does_not_exist',
  unique: 'unique',
  // Request documents.
  parseError: 'parse_error',
  unsupportedMediaType: 'unsupported_media_type',
  /** A 409: the document's type or id does not match the endpoint. */
  conflict: 'error',
  /**
   * A 409: a reorder, a tagging, or an admin account change raced another
   * write; retrying can succeed.
   */
  orderingConflict: 'conflict',
  // Everything else.
  notFound: 'not_found',
  methodNotAllowed: 'method_not_allowed',
  notAuthenticated: 'not_authenticated',
  permissionDenied: 'permission_denied',
  authenticationFailed: 'authentication_failed',
  originNotAllowed: 'origin_not_allowed',
  /**
   * A 409: a write names another user (`EXPECTED_USER_HEADER`) than the one
   * the request is signed in as.
   */
  userMismatch: 'user_mismatch',
  serverError: 'error',
} as const;

export type ErrorCode = (typeof CODES)[keyof typeof CODES];

export const MESSAGES = {
  // Serializer fields (DRF).
  required: 'This field is required.',
  null: 'This field may not be null.',
  blank: 'This field may not be blank.',
  notAString: 'Not a valid string.',
  maxLength: (max: number) =>
    `Ensure this field has no more than ${max} characters.`,
  notABoolean: 'Must be a valid boolean.',
  notAnInteger: 'Must be a valid integer.',
  readOnly: 'This field cannot be changed.',
  incorrectPkType: (received: string) =>
    `Incorrect type. Expected pk value, received ${received}.`,
  pkDoesNotExist: (pk: string) => `Invalid pk "${pk}" - object does not exist.`,

  // Request documents (django-rest-framework-json-api's parser).
  jsonParseError: (reason: string) => `JSON parse error - ${reason}`,
  noPrimaryData: 'Received document does not contain primary data',
  typeMismatch: (received: string, expected: string) =>
    `The resource object's type (${received}) is not the type that ` +
    `constitute the collection represented by the endpoint (${expected}).`,
  idMissing: "The resource identifier object must contain an 'id' member",
  idMismatch: (received: string, expected: string) =>
    `The resource object's id (${received}) does not match the endpoint's id (${expected}).`,
  invalidLinkage:
    'Received data is not a valid JSONAPI Resource Identifier Object',

  // Query parameters (django-rest-framework-json-api's query validation).
  invalidQueryParameter: (key: string) => `invalid query parameter: ${key}`,
  repeatedQueryParameter: (key: string) =>
    `repeated query parameter not allowed: ${key}`,
  missingFilterValue: (key: string) =>
    `missing value for query parameter ${key}`,
  invalidFilter: (name: string) => `invalid filter[${name}]`,
  invalidSort: (terms: readonly string[]) =>
    `invalid sort parameter${terms.length > 1 ? 's' : ''}: ${terms.join(',')}`,
  invalidPage: 'Invalid page.',
  invalidCursor: (value: string) =>
    `invalid page[after]: ${value} (expected <date_updated>,<id>)`,
  cursorRefused: 'page[after] is not supported here.',
  cursorWithPage: 'page[after] and page[number] cannot be combined.',
  cursorWithSort:
    'page[after] pages in revision order (date_updated, id): leave out sort.',
  includeTooDeep: (path: string, max: number) =>
    `Include path ${path} is deeper than ${max} relationships.`,
  includeNotSupported: (path: string) =>
    `This endpoint does not support the include parameter for path ${path}`,
  includeRefused: 'include is not supported here.',
  searchRefused: 'filter[search] is not supported here.',

  // Filter values (django-filter's form fields).
  enterANumber: 'Enter a number.',
  enterABoolean: 'Enter a valid boolean.',
  enterADateTime: 'Enter a valid date/time.',
} as const;

/**
 * The header a client's writes name the user they act for with (their
 * username, URI-encoded): the API refuses a state-changing request signed in
 * as anyone else (409 `user_mismatch`), so a browser tab whose session
 * another tab has replaced cannot write into the new user's account.
 */
export const EXPECTED_USER_HEADER = 'X-Expected-User';

/**
 * The header a write names when it was made in (a datetime, as
 * `parseDateTime` reads it). Clients queue writes and send them later, so
 * the API resolves conflicts by edit time, last writer wins: a write to a
 * tag, entry or junction applies only when it is no older than the row's
 * last one, and otherwise changes nothing (the response is the row as it
 * stands). A time ahead of the API's clock counts as now; a write without
 * the header counts as made now (a retry of one named by
 * `CLIENT_WRITE_ID_HEADER`, as made when it first arrived).
 */
export const CLIENT_UPDATED_HEADER = 'Client-Updated';

/**
 * The header naming a queued write: an id the client gives it (at most
 * `CLIENT_WRITE_ID_MAX_LENGTH` characters), the same on every attempt to
 * send it. A write made ahead of the API's clock counts as made when it
 * first arrived, and so does every retry of it: a retry after a lost answer
 * never beats a write made between its attempts.
 */
export const CLIENT_WRITE_ID_HEADER = 'Client-Write-Id';
export const CLIENT_WRITE_ID_MAX_LENGTH = 64;

/**
 * The header every API response carries its version in (the API's
 * `package.json` version), for clients to show which API they talk to. A
 * cross-origin client can read it: the API lists it in
 * `Access-Control-Expose-Headers`.
 */
export const API_VERSION_HEADER = 'API-Version';
