// Request counting utilities for MSW handlers

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

interface RequestCount {
  method: HttpMethod;
  url: string;
  count: number;
}

/** The counts, by `makeKey` of their method and URL. */
const requestCounts = new Map<string, RequestCount>();

function makeKey(method: HttpMethod, url: string): string {
  return `${method} ${url}`;
}

/**
 * Count a request under its exact URL and under the URL without its query,
 * so tests can match either. A URL without a query is one key, counted once.
 */
export function recordRequest(method: HttpMethod, url: string): void {
  const urlString = `${url}`;
  const normalizedUrl = urlString.split('?')[0] ?? urlString;
  for (const counted of new Set([urlString, normalizedUrl])) {
    const key = makeKey(method, counted);
    const held = requestCounts.get(key);
    if (held === undefined) {
      requestCounts.set(key, {method, url: counted, count: 1});
    } else {
      held.count += 1;
    }
  }
}

export function getRequestCount(method: HttpMethod, url: string): number {
  return requestCounts.get(makeKey(method, url))?.count ?? 0;
}

export function resetRequestCounts(): void {
  requestCounts.clear();
}

export function getAllRequestCounts(): RequestCount[] {
  return [...requestCounts.values()].map(counted => ({...counted}));
}
