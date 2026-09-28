import {handleUnauthorized} from '../auth/authUtils';

/**
 * `fetch`, but a 403 means the session is gone: sign the user out of the app
 * (`handleUnauthorized`) and return the response as usual.
 *
 * `tearleadsApi` sends every request through this except:
 * - `googleLogin` and `githubLogin`, which run before there is a session, so
 *   a 403 there is a failed login, not an expired one.
 *
 * `adminApi` does not use it either. It handles 401 and 403 itself: a 403
 * with `permission_denied` means signed in but not staff (the page says so
 * rather than signing out), and `/user` answers 401 once the session has
 * expired, which this 403-only check would miss.
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, options);

  if (response.status === 403) {
    handleUnauthorized();
  }

  return response;
}
