/** `TagTextEntryThroughModel`'s requests (`/api/v1/tags_entries`). */
import {z} from 'zod';
import {relatedField} from '../../fields';
import {createDocumentSchema, noFieldsSchema} from '../../jsonapi/request';
import {TAG, TAG_TEXT_ENTRY, TEXT_ENTRY} from '../types';
import {reorderAttributesSchema} from './reorder';

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
