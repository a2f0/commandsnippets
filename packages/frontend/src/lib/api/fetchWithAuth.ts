import {handleUnauthorized} from '../auth/authUtils';

/**
 * The 403 error codes that mean the session is gone: `not_authenticated`
 * (backend-v2 on an anonymous or expired request to a resource endpoint) and
 * `authentication_failed` (DRF's AuthenticationFailed, a credential the API
 * refuses). Every other code keeps the session: `permission_denied` is a
 * signed-in user asking for someone else's object, and `origin_not_allowed`
 * a state-changing request from outside the CORS allowlist.
 */
const signedOutCodes: ReadonlySet<string> = new Set([
  'not_authenticated',
  'authentication_failed',
]);

/**
 * The `code` of the first error in a JSON:API error document
 * (`{errors: [{status, code, detail, ...}]}`), or undefined when the body is
 * not one or its first error has no string code.
 */
async function firstErrorCode(response: Response): Promise<string | undefined> {
  const body: unknown = await response.json().catch(() => undefined);
  if (
    typeof body !== 'object' ||
    body === null ||
    !('errors' in body) ||
    !Array.isArray(body.errors)
  ) {
    return undefined;
  }
  const error: unknown = body.errors[0];
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return typeof error.code === 'string' ? error.code : undefined;
}

/**
 * Whether a response means the session is gone. The code is read from a
 * clone, so the caller can still read the body.
 *
 * A 403 without a code (the body is not a JSON:API error document, or its
 * first error has none) counts as signed out, as every 403 did before the
 * codes were read. backend-v2 puts a code on every 403 it sends, so such a
 * 403 comes from something else (a proxy, a gateway, another backend), and
 * there is no telling whether the session is still good. Signing out is then
 * the mistake the user recovers from, by signing in again; staying signed in
 * on a dead session would leave a signed-in app whose every request fails.
 */
async function meansSignedOut(response: Response): Promise<boolean> {
  if (response.status === 401) {
    return true;
  }
  if (response.status !== 403) {
    return false;
  }
  const code = await firstErrorCode(response.clone());
  return code === undefined || signedOutCodes.has(code);
}

/**
 * `fetch`, but when the response means the session is gone, sign the user
 * out of the app (`handleUnauthorized`). The response is returned as is,
 * with its body unread, either way.
 *
 * The session is gone on:
 * - a 401, which `/user` and `/api-token-deauth/` answer once it has expired;
 * - a 403 whose first error `code` is `not_authenticated` (an anonymous or
 *   expired request to a resource endpoint) or `authentication_failed`;
 * - a 403 with no code (see `meansSignedOut`).
 *
 * Any other 403 keeps it: `permission_denied` (someone else's object) and
 * `origin_not_allowed` (a request from outside the CORS allowlist) are
 * refusals of one request, not of the session.
 *
 * `apiClient` sends every request through this except `googleLogin` and
 * `githubLogin`, which run before there is a session: a 401 or 403
 * (`authentication_failed`) there is a failed login, not an expired one.
 *
 * `adminApi` does not use it either: it handles 401 and 403 itself, so the
 * admin page can say "not staff" on a `permission_denied` instead of signing
 * out, and sign out itself when `getStaffStatus` finds the session gone.
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, options);

  if (await meansSignedOut(response)) {
    handleUnauthorized();
  }

  return response;
}
