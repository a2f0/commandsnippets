/**
 * Where the router reads and changes the URL: the browser's (`window.history`,
 * and `popstate` for Back and Forward), or for tests the `history` package's
 * memory history, which has the same shape.
 */

export interface RouterLocation {
  readonly pathname: string;
  readonly search: string;
}

export interface RouterHistory {
  /** The location now: the same object until it changes. */
  readonly location: RouterLocation;
  /** Call `listener` after each change. Returns the unsubscribe. */
  listen(listener: () => void): () => void;
  /** Go to `to` (a path, with a query), a new entry in the history. */
  push(to: string): void;
  /** Go to `to`, in place of the current entry. */
  replace(to: string): void;
}

/** The browser's history. */
export function createBrowserHistory(): RouterHistory {
  const listeners = new Set<() => void>();
  const read = (): RouterLocation => ({
    pathname: window.location.pathname,
    search: window.location.search,
  });
  let location = read();
  const changed = () => {
    location = read();
    for (const listener of listeners) {
      listener();
    }
  };
  window.addEventListener('popstate', changed);
  return {
    get location() {
      return location;
    },
    listen(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    push(to) {
      window.history.pushState(null, '', to);
      changed();
    },
    replace(to) {
      window.history.replaceState(null, '', to);
      changed();
    },
  };
}
