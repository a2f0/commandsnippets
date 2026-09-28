/**
 * A collection's query parameters (api-shared's `TagListParams`,
 * `AdminUserListParams`, ...) as a query string.
 */

type QueryValue = string | number | boolean | undefined;
type QueryParams<T> = {[K in keyof T]?: QueryValue};

/** Query parameters in their order, leaving out the undefined ones. */
export function toSearchParams<T extends QueryParams<T>>(
  params: T
): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries<QueryValue>(params)) {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  }
  return searchParams;
}

/** `path` (an absolute URL) with `params` as its query. */
export function urlWithQuery<T extends QueryParams<T>>(
  path: string,
  params: T
): string {
  const url = new URL(path);
  url.search = toSearchParams(params).toString();
  return url.toString();
}
