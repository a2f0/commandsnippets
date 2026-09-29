/** `TagTextEntryThroughModel`'s requests (`/api/v1/tags_entries`). */
import * as z from 'zod/mini';
import {relatedField} from '../../fields';
import {booleanFilter, dateTimeFilter, integerFilter} from '../../filters';
import type {IncludePath} from '../../include';
import {createDocumentSchema, noFieldsSchema} from '../../jsonapi/request';
import {type ListParams, listQuerySchema} from '../../query';
import {type RELATIONSHIPS, TAG, TAG_TEXT_ENTRY, TEXT_ENTRY} from '../types';
import {reorderAttributesSchema} from './reorder';

/**
 * POST: tag an entry (get-or-create, always 201; a deleted junction of the
 * pair comes back). Both must be the requester's.
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

// The collection's query

/**
 * The collection's query, which `tagTextEntryListQuerySchema` validates and
 * `TagTextEntryListParams` types. Deleted junctions are listed too (filter
 * them with `is_deleted`), so a tag's junctions after a cursor are what
 * changed in it.
 */
const tagTextEntryListQuery = {
  filters: {
    tag__id: integerFilter,
    text_entry__id: integerFilter,
    is_deleted: booleanFilter,
    /** Sync: junctions changed after a revision. */
    date_updated__gt: dateTimeFilter,
  },
  sort: ['date_updated'],
  search: 'refused',
  include: 'resolved',
  cursor: 'supported',
} as const;

export const tagTextEntryListQuerySchema = listQuerySchema(
  tagTextEntryListQuery
);

export type TagTextEntryListQuery = z.output<
  typeof tagTextEntryListQuerySchema
>;
/** `GET /api/v1/tags_entries`'s query parameters, as a client sends them. */
export type TagTextEntryListParams = ListParams<
  typeof tagTextEntryListQuery,
  IncludePath<typeof RELATIONSHIPS, typeof TAG_TEXT_ENTRY>
>;
