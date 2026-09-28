/** `Tag`: `/api/v1/tags`. Its requests are in `requests/tag.ts`. */
import * as z from 'zod/mini';
import {
  countSchema,
  relatedResourceSchema,
  relationshipsSchema,
  timestampSchema,
} from '../jsonapi/response';
import {RELATIONSHIPS, TAG} from './types';

export const tagAttributesSchema = z.object({
  name: z.string(),
  date_created: timestampSchema,
  date_last_used: z.nullable(timestampSchema),
  date_updated: timestampSchema,
  entry_count: countSchema,
  order: countSchema,
  is_deleted: z.boolean(),
});

export const tagSchema = relatedResourceSchema(
  TAG,
  tagAttributesSchema,
  relationshipsSchema(RELATIONSHIPS[TAG])
);

export type TagAttributes = z.output<typeof tagAttributesSchema>;
export type Tag = z.output<typeof tagSchema>;
