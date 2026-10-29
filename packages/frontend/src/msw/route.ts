/**
 * What every route module shares: `route`, the API hosts, and the guard
 * against requests made as another user.
 */
import {
  CODES,
  EXPECTED_USER_HEADER,
  EXPECTED_USER_ID_HEADER,
} from '@commandsnippets/api-shared';
import {type HttpResponseResolver, http} from 'msw/http';
import {testUser} from './fixtures';
import {recordRequest} from './requestCounter';
import {apiError, errorResponse} from './requests';

/** What a route's resolver is given: the request and its path parameters. */
type RouteInfo = Parameters<HttpResponseResolver>[0];

const methodHandlers = {
  GET: http.get,
  POST: http.post,
  PATCH: http.patch,
  DELETE: http.delete,
};

/**
 * The handler of `method` requests to `path`: each request is counted
 * (`requestCounter.ts`) before `resolve` answers it, and an API error it
 * throws (`MockApiError`) is answered with its error document.
 */
export function route(
  method: keyof typeof methodHandlers,
  path: string,
  resolve: (info: RouteInfo) => Response | Promise<Response>
) {
  return methodHandlers[method](path, async info => {
    recordRequest(method, info.request.url);
    try {
      return await resolve(info);
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export const apiHosts = [
  'http://localhost:9001',
  'https://api-staging.commandsnippets.com',
  'https://api.commandsnippets.com',
] as const;

/** The user the mock API is signed in as (what `/user/` answers). */
export const SIGNED_IN_USER = 'test';

/**
 * A request naming another user than the signed-in one, refused as the API
 * refuses it (409 `user_mismatch`); anything else goes on to the handlers.
 */
export function refuseAnotherUsersRequest(request: Request) {
  const expected = request.headers.get(EXPECTED_USER_HEADER);
  const expectedId = request.headers.get(EXPECTED_USER_ID_HEADER);
  if (
    (expected === null || decodeURIComponent(expected) === SIGNED_IN_USER) &&
    (expectedId === null || expectedId === testUser.id)
  ) {
    return undefined;
  }
  return errorResponse(
    apiError(
      409,
      CODES.userMismatch,
      'The request is not signed in as the user it names.'
    )
  );
}
