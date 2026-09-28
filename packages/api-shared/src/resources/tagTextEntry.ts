/**
 * `TagTextEntryThroughModel`: a tag on an entry, ranked within its tag
 * (`/api/v1/tags_entries`: create, delete and reorder only). Its requests are
 * in `requests/tagTextEntry.ts`.
 */
import {z} from 'zod';
import {
  relatedResourceSchema,
  relationshipsSchema,
  timestampSchema,
} from '../jsonapi/response';
import {RELATIONSHIPS, TAG_TEXT_ENTRY} from './types';

export const tagTextEntryAttributesSchema = z.object({
  order: z.number().int().nonnegative(),
  date_updated: timestampSchema,
  date_created: timestampSchema,
});

export const tagTextEntrySchema = relatedResourceSchema(
  TAG_TEXT_ENTRY,
  tagTextEntryAttributesSchema,
  relationshipsSchema(RELATIONSHIPS[TAG_TEXT_ENTRY])
);

export type TagTextEntryAttributes = z.output<
  typeof tagTextEntryAttributesSchema
>;
export type TagTextEntry = z.output<typeof tagTextEntrySchema>;
