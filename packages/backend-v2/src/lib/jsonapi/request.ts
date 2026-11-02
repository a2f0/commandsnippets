/**
 * Request documents, read as django-rest-framework-json-api's parser read
 * them: the media type, the JSON, then the envelope (api-shared's
 * `requestEnvelopeSchema`, whose messages clients and tests rely on).
 */
import {
  JSON_MEDIA_TYPES,
  MESSAGES,
  mediaTypeOf,
  type RequestResource,
  requestEnvelopeSchema,
} from '@commandsnippets/api-shared';
import {parseError, unsupportedMediaType} from '../errors';
import {parseOrThrow} from '../validate';

interface ParseOptions {
  /** The resource type the endpoint accepts (DJA's resource_name). */
  type: string;
  /** For PATCH/PUT: the id from the URL, which the document must match. */
  id?: string;
}

/** 415 unless the request declares a JSON body (api-shared's `JSON_MEDIA_TYPES`). */
export function assertJsonMediaType(request: Request): void {
  const mediaType = mediaTypeOf(request.headers.get('Content-Type'));
  if (!JSON_MEDIA_TYPES.has(mediaType)) {
    throw unsupportedMediaType(mediaType);
  }
}

/**
 * A request's JSON body: 415 unless it is declared JSON, 400 on a JSON
 * syntax error. An empty (or blank) body reads as `{}` when `allowEmpty`,
 * as DJA's parser read it, and is a syntax error otherwise.
 */
export async function readJson(
  request: Request,
  allowEmpty: boolean
): Promise<unknown> {
  assertJsonMediaType(request);
  const text = await request.text();
  if (allowEmpty && text.trim() === '') {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw parseError(
      MESSAGES.jsonParseError(
        error instanceof Error ? error.message : String(error)
      )
    );
  }
}

/**
 * A request document's primary data (api-shared's `requestEnvelopeSchema`):
 * 415 unless JSON, 400 on a JSON syntax error, then the envelope's first
 * error. Attributes and relationships are validated by the caller.
 */
export async function parseResource(
  request: Request,
  {type, id}: ParseOptions
): Promise<RequestResource> {
  const document = await readJson(request, true);
  return parseOrThrow(requestEnvelopeSchema({type, id}), document);
}
