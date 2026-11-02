/** The JSON:API media type, which every response document is sent as. */
export const JSON_API_MEDIA_TYPE = 'application/vnd.api+json';

/**
 * The media types a request body may declare: both make a cross-origin
 * request "non-simple", so the browser preflights it and the API's CORS
 * allowlist applies (`text/plain` or a form post would skip the preflight:
 * login CSRF). DRF-JSON:API likewise answered other media types with 415.
 */
export const JSON_MEDIA_TYPES: ReadonlySet<string> = new Set([
  JSON_API_MEDIA_TYPE,
  'application/json',
]);

/** A `Content-Type` header's media type, lowercased, without parameters. */
export function mediaTypeOf(contentType: string | null): string {
  return (contentType ?? '').split(';', 1)[0]?.trim().toLowerCase() ?? '';
}
