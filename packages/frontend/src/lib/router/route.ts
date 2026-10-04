/**
 * The app's routes, by the URL's path: the OAuth callbacks, the admin page, a
 * user's page (`/:user`, `/:user/:tag`) and the root. Every other first path
 * segment is a username (`routePaths.ts`). Paths match as React Router
 * matched them: decoded, the app's own paths in any case, a trailing slash
 * ignored.
 */
import {
  ADMIN_PATH,
  GITHUB_OAUTH_PATH,
  GOOGLE_OAUTH_PATH,
} from '../../routePaths';

export type Page =
  | 'admin'
  | 'githubOAuth'
  | 'googleOAuth'
  | 'user'
  | 'root'
  /** No route: a path of more segments, or an empty one. */
  | 'none';

export interface Route {
  page: Page;
  /** On a user's page: whose it is (`/:user`). */
  user?: string | undefined;
  /** On a user's page: the tag shown (`/:user/:tag`). */
  tag?: string | undefined;
}

const STATIC_PAGES: ReadonlyArray<readonly [string, Page]> = [
  [ADMIN_PATH, 'admin'],
  [GITHUB_OAUTH_PATH, 'githubOAuth'],
  [GOOGLE_OAUTH_PATH, 'googleOAuth'],
];

/**
 * `pathname` decoded segment by segment, a decoded `/` kept as `%2F` so no
 * segment splits; as it is when it is not valid percent-encoding.
 */
function decodePath(pathname: string): string {
  try {
    return pathname
      .split('/')
      .map(segment => decodeURIComponent(segment).replace(/\//g, '%2F'))
      .join('/');
  } catch {
    return pathname;
  }
}

/** A path segment as a route's value: with its `/`s back. */
const paramOf = (segment: string) => segment.replace(/%2F/g, '/');

/** The route of the URL path `pathname`. */
export function routeOf(pathname: string): Route {
  const path = decodePath(pathname).replace(/\/+$/, '');
  if (path === '') {
    return {page: 'root'};
  }
  const lower = path.toLowerCase();
  const page = STATIC_PAGES.find(([staticPath]) => staticPath === lower)?.[1];
  if (page !== undefined) {
    return {page};
  }
  const [user, tag, ...rest] = path.split('/').slice(1);
  if (user === undefined || user === '' || tag === '' || rest.length > 0) {
    return {page: 'none'};
  }
  return tag === undefined
    ? {page: 'user', user: paramOf(user)}
    : {page: 'user', user: paramOf(user), tag: paramOf(tag)};
}
