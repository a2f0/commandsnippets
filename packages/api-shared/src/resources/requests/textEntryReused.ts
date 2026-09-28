/** `TextEntryReused`'s requests (`/api/v1/entry_reuses`). */
import {z} from 'zod';
import {relatedField} from '../../fields';
import {createDocumentSchema, noFieldsSchema} from '../../jsonapi/request';
import {listQuerySchema} from '../../query';
import {TEXT_ENTRY, TEXT_ENTRY_REUSED} from '../types';

/** POST: the entry must be the requester's. */
export const textEntryReusedCreateRelationshipsSchema = z.object({
  text_entry: relatedField(TEXT_ENTRY),
});

export const textEntryReusedCreateDocumentSchema = createDocumentSchema(
  TEXT_ENTRY_REUSED,
  {
    attributes: noFieldsSchema,
    relationships: textEntryReusedCreateRelationshipsSchema,
  }
);

export type TextEntryReusedCreateRelationships = z.output<
  typeof textEntryReusedCreateRelationshipsSchema
>;
export type TextEntryReusedCreateDocument = z.output<
  typeof textEntryReusedCreateDocumentSchema
>;

// The collection's query

export const TEXT_ENTRY_REUSED_SORT_FIELDS = ['date_created'] as const;

/** No filters; `filter[search]` is accepted and ignored. */
export const textEntryReusedListQuerySchema = listQuerySchema({
  filters: {},
  sort: TEXT_ENTRY_REUSED_SORT_FIELDS,
  search: 'ignored',
  include: 'resolved',
});

export type TextEntryReusedSortField =
  (typeof TEXT_ENTRY_REUSED_SORT_FIELDS)[number];
export type TextEntryReusedListQuery = z.output<
  typeof textEntryReusedListQuerySchema
>;
