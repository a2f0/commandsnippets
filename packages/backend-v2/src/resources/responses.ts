/** JSON:API responses: every document goes out as `application/vnd.api+json`. */
import {JSON_API_MEDIA_TYPE} from '@commandsnippets/api-shared';
import type {Context} from 'hono';
import type {ContentfulStatusCode} from 'hono/utils/http-status';
import type {AppEnv} from '../env';

export function jsonApi(
  c: Context<AppEnv>,
  body: unknown,
  status: ContentfulStatusCode = 200
): Response {
  return c.body(JSON.stringify(body), status, {
    'Content-Type': JSON_API_MEDIA_TYPE,
  });
}
