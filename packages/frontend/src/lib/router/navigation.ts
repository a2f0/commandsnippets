/**
 * The app's router: the URL as an external store that components read through
 * selectors (`useRoute`), so a component renders again only when what it
 * reads of the URL changes. A tag switch renders what shows the tag, not
 * every tag and entry row, as React Router's hooks did (they render every
 * component that calls them on any change of the URL, `React.memo` or not).
 * Navigating is a function (`navigate`), so nothing subscribes to the URL
 * only to change it.
 */
import {useSyncExternalStore} from 'react';
import {createBrowserHistory, type RouterHistory} from './history';
import {type Route, routeOf} from './route';

let history: RouterHistory | null = null;
let unlisten: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Follow `next` from now on: the app follows the browser's history unless
 * given another (a test's memory history, `Router`). One at a time.
 */
export function attachHistory(next: RouterHistory): void {
  if (next === history) {
    return;
  }
  unlisten?.();
  history = next;
  unlisten = next.listen(notify);
}

/** The history followed: the browser's, until another is attached. */
function followed(): RouterHistory {
  if (history === null) {
    const browser = createBrowserHistory();
    attachHistory(browser);
    return browser;
  }
  return history;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The last path's route and the last query's parameters, which every reader
// of them shares until the URL changes.
let parsedPath: {pathname: string; route: Route} | null = null;
let parsedSearch: {search: string; params: URLSearchParams} | null = null;

function routeAt(pathname: string): Route {
  if (parsedPath?.pathname !== pathname) {
    parsedPath = {pathname, route: routeOf(pathname)};
  }
  return parsedPath.route;
}

function searchAt(search: string): URLSearchParams {
  if (parsedSearch?.search !== search) {
    parsedSearch = {search, params: new URLSearchParams(search)};
  }
  return parsedSearch.params;
}

/**
 * What `select` reads of the route and the query, rendering again only when
 * that changes, so it returns a value, never a new object (which would
 * differ every time).
 */
export function useRoute<
  T extends string | number | boolean | null | undefined,
>(select: (route: Route, search: URLSearchParams) => T): T {
  return useSyncExternalStore(subscribe, () => {
    const {pathname, search} = followed().location;
    return select(routeAt(pathname), searchAt(search));
  });
}

/** A parameter of a user's page: whose (`user`), or the tag shown (`tag`). */
export const useRouteParam = (name: 'user' | 'tag'): string | undefined =>
  useRoute(route => route[name]);

/** A parameter of the query: `entries` (`?entries=all`). */
export const useSearchParam = (name: string): string | null =>
  useRoute((_, search) => search.get(name));

/**
 * The route now, for an event handler or an effect, which need not render
 * again when it changes.
 */
export const currentRoute = (): Route => routeAt(followed().location.pathname);

/** The path and query now. */
export function currentPath(): string {
  const {pathname, search} = followed().location;
  return `${pathname}${search}`;
}

/**
 * Go to `to` (an absolute path, with a query): a new history entry, or in
 * place of the current one (`replace`).
 */
export function navigate(
  to: string,
  {replace = false}: {replace?: boolean} = {}
): void {
  const target = followed();
  if (replace) {
    target.replace(to);
  } else {
    target.push(to);
  }
}
