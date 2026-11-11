/**
 * The app's routes, by the URL's path: the OAuth callbacks, the admin page, a
 * user's page (`/:user`, `/:user/:tag`, or `/:user/tags/~.` and
 * `/:user/tags/~..` for dot-only tags), one of their entries'
 * (`/:user/entries/:id`) and the root. Every other first path
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
  /** An entry's page: its info and reuses (`/:user/entries/:id`). */
  | 'entry'
  | 'reuses'
  | 'analytics'
  | 'root'
  /** No route: a path of more segments, or an empty one. */
  | 'none';

export interface Route {
  page: Page;
  /** On a user's page: whose it is (`/:user`). */
  user?: string | undefined;
  /** On a user's page: the tag shown (`/:user/:tag`). */
  tag?: string | undefined;
  /** On an entry's page: its id (`/:user/entries/:id`). */
  entryId?: string | undefined;
}

/** The path of `user`'s page, preserving the username as one segment. */
export const userPath = (user: string): string =>
  `/${encodeURIComponent(user)}`;

/** The path of `user`'s entry `entryId`'s page. */
export const entryPath = (user: string, entryId: string): string =>
  `/${encodeURIComponent(user)}/entries/${encodeURIComponent(entryId)}`;

/** Dot-only tags need a segment the browser will not normalize away. */
export const tagPath = (user: string, tag: string): string =>
  `/${encodeURIComponent(user)}/${tag === '.' || tag === '..' ? `tags/~${tag}` : encodeURIComponent(tag)}`;

export const reusesPath = (user: string): string =>
  `/${encodeURIComponent(user)}/activity/reuses`;

export const analyticsPath = (user: string): string =>
  `/${encodeURIComponent(user)}/activity/analytics`;

const STATIC_PAGES: ReadonlyArray<readonly [string, Page]> = [
  [ADMIN_PATH, 'admin'],
  [GITHUB_OAUTH_PATH, 'githubOAuth'],
  [GOOGLE_OAUTH_PATH, 'googleOAuth'],
];

/**
 * Split before decoding, so an encoded slash stays inside its segment and
 * a literal `%2F` is never decoded twice. Leave only malformed segments as-is.
 */
function decodedSegments(pathname: string): string[] {
  return pathname.split('/').map(segment => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
}

/** The route of the URL path `pathname`. */
export function routeOf(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '');
  if (path === '') {
    return {page: 'root'};
  }
  const segments = decodedSegments(path);
  const page = STATIC_PAGES.find(([staticPath]) => {
    const expected = staticPath.split('/');
    return (
      expected.length === segments.length &&
      expected.every((value, index) => value === segments[index]?.toLowerCase())
    );
  })?.[1];
  if (page !== undefined) {
    return {page};
  }
  const [user, tag, ...rest] = segments.slice(1);
  const [entryId] = rest;
  if (
    user &&
    tag === 'tags' &&
    rest.length === 1 &&
    (entryId === '~.' || entryId === '~..')
  ) {
    return {page: 'user', user, tag: entryId.slice(1)};
  }
  if (
    user &&
    tag === 'activity' &&
    rest.length === 1 &&
    entryId === 'analytics'
  ) {
    return {page: 'analytics', user};
  }
  if (user && tag === 'activity' && rest.length === 1 && entryId === 'reuses') {
    return {page: 'reuses', user};
  }
  if (
    user !== undefined &&
    user !== '' &&
    tag === 'entries' &&
    rest.length === 1 &&
    entryId !== undefined &&
    entryId !== ''
  ) {
    return {page: 'entry', user, entryId};
  }
  if (user === undefined || user === '' || tag === '' || rest.length > 0) {
    return {page: 'none'};
  }
  return tag === undefined ? {page: 'user', user} : {page: 'user', user, tag};
}
