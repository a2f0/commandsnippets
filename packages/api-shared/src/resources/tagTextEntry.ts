/**
 * `TagTextEntryThroughModel`: a tag on an entry, ranked within its tag
 * (`/api/v1/tags_entries`: list, create, delete and reorder). Untagging
 * soft-deletes it (`is_deleted`), so a tag's junctions, listed in revision
 * order, are everything that changed in the tag: entries joining and leaving
 * it, re-ranked, and edited (an entry's revision advances its junctions').
 * An entry's `text_entry_to_tag` lists only the ones not deleted. Its
 * requests are in `requests/tagTextEntry.ts`.
 */
import * as z from 'zod/mini';
import {
  countSchema,
  relatedResourceSchema,
  relationshipsSchema,
  timestampSchema,
} from '../jsonapi/response';
import {RELATIONSHIPS, TAG_TEXT_ENTRY} from './types';

export const tagTextEntryAttributesSchema = z.object({
  order: countSchema,
  date_updated: timestampSchema,
  date_created: timestampSchema,
  is_deleted: z.boolean(),
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
