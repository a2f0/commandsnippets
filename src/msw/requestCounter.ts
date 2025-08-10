// Request counting utilities for MSW handlers

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

const requestCountMap: Map<string, number> = new Map();

function makeKey(method: HttpMethod, url: string): string {
  return `${method} ${url}`;
}

export function recordRequest(method: HttpMethod, url: string): void {
  const key = makeKey(method, url);
  const current = requestCountMap.get(key) ?? 0;
  requestCountMap.set(key, current + 1);
}

export function getRequestCount(method: HttpMethod, url: string): number {
  const key = makeKey(method, url);
  return requestCountMap.get(key) ?? 0;
}

export function resetRequestCounts(): void {
  requestCountMap.clear();
}

export function getAllRequestCounts(): Array<{
  method: HttpMethod;
  url: string;
  count: number;
}> {
  const results: Array<{method: HttpMethod; url: string; count: number}> = [];
  for (const [key, count] of requestCountMap.entries()) {
    const spaceIndex = key.indexOf(' ');
    const method = key.slice(0, spaceIndex) as HttpMethod;
    const url = key.slice(spaceIndex + 1);
    results.push({method, url, count});
  }
  return results;
}
