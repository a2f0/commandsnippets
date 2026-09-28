/**
 * The app's own top-level routes. Every other first path segment is a username
 * (`/:user/:tag`), so the API must never give out one of these segments as a
 * username: each is listed in backend-v2's
 * `src/services/reserved-usernames.json`, which a test checks.
 */
export const ADMIN_PATH = '/admin';
export const GITHUB_OAUTH_PATH = '/oauth/github';
export const GOOGLE_OAUTH_PATH = '/oauth/google';

export const STATIC_ROUTE_PATHS = [
  ADMIN_PATH,
  GITHUB_OAUTH_PATH,
  GOOGLE_OAUTH_PATH,
] as const;
