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
  const urlString = `${url}`;
  const exactKey = makeKey(method, urlString);
  const normalizedUrl = urlString.split('?')[0] ?? urlString;
  const normalizedKey = makeKey(method, normalizedUrl);

  const exactCurrent = requestCountMap.get(exactKey) ?? 0;
  requestCountMap.set(exactKey, exactCurrent + 1);

  const normalizedCurrent = requestCountMap.get(normalizedKey) ?? 0;
  requestCountMap.set(normalizedKey, normalizedCurrent + 1);
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
