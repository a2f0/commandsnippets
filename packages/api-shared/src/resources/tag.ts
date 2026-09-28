/** `Tag`: `/api/v1/tags`. Its requests are in `requests/tag.ts`. */
import {z} from 'zod';
import {
  relatedResourceSchema,
  relationshipsSchema,
  timestampSchema,
} from '../jsonapi/response';
import {RELATIONSHIPS, TAG} from './types';

export const tagAttributesSchema = z.object({
  name: z.string(),
  date_created: timestampSchema,
  date_last_used: timestampSchema.nullable(),
  date_updated: timestampSchema,
  entry_count: z.number().int().nonnegative(),
  order: z.number().int().nonnegative(),
  is_deleted: z.boolean(),
});

export const tagSchema = relatedResourceSchema(
  TAG,
  tagAttributesSchema,
  relationshipsSchema(RELATIONSHIPS[TAG])
);

export type TagAttributes = z.output<typeof tagAttributesSchema>;
export type Tag = z.output<typeof tagSchema>;
