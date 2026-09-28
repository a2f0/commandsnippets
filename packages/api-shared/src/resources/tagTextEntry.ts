/**
 * `TagTextEntryThroughModel`: a tag on an entry, ranked within its tag
 * (`/api/v1/tags_entries`: create, delete and reorder only).
 */
import {z} from 'zod';
import {relatedField} from '../fields';
import {createDocumentSchema, noFieldsSchema} from '../jsonapi/request';
import {
  relatedResourceSchema,
  relationshipsSchema,
  timestampSchema,
} from '../jsonapi/response';
import {reorderAttributesSchema} from './reorder';
import {RELATIONSHIPS, TAG, TAG_TEXT_ENTRY, TEXT_ENTRY} from './types';

// Responses

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

// Requests

/**
 * POST: tag an entry (get-or-create, always 201). Both must be the
 * requester's.
 */
export const tagTextEntryCreateRelationshipsSchema = z.object({
  tag: relatedField(TAG),
  text_entry: relatedField(TEXT_ENTRY),
});

export const tagTextEntryCreateDocumentSchema = createDocumentSchema(
  TAG_TEXT_ENTRY,
  {
    attributes: noFieldsSchema,
    relationships: tagTextEntryCreateRelationshipsSchema,
  }
);

/** `POST /api/v1/tags_entries/reorder`: within one tag. */
export const tagTextEntryReorderDocumentSchema = createDocumentSchema(
  TAG_TEXT_ENTRY,
  {attributes: reorderAttributesSchema, relationships: noFieldsSchema}
);

export type TagTextEntryCreateRelationships = z.output<
  typeof tagTextEntryCreateRelationshipsSchema
>;
export type TagTextEntryCreateDocument = z.output<
  typeof tagTextEntryCreateDocumentSchema
>;
export type TagTextEntryReorderDocument = z.output<
  typeof tagTextEntryReorderDocumentSchema
>;
