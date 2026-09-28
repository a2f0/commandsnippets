/** `TextEntryReused`'s requests (`/api/v1/entry_reuses`). */
import * as z from 'zod/mini';
import {relatedField} from '../../fields';
import type {IncludePath} from '../../include';
import {createDocumentSchema, noFieldsSchema} from '../../jsonapi/request';
import {type ListParams, listQuerySchema} from '../../query';
import {type RELATIONSHIPS, TEXT_ENTRY, TEXT_ENTRY_REUSED} from '../types';

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

/**
 * The collection's query, which `textEntryReusedListQuerySchema` validates
 * and `TextEntryReusedListParams` types. No filters; `filter[search]` is
 * accepted and ignored.
 */
const textEntryReusedListQuery = {
  filters: {},
  sort: TEXT_ENTRY_REUSED_SORT_FIELDS,
  search: 'ignored',
  include: 'resolved',
} as const;

export const textEntryReusedListQuerySchema = listQuerySchema(
  textEntryReusedListQuery
);

export type TextEntryReusedSortField =
  (typeof TEXT_ENTRY_REUSED_SORT_FIELDS)[number];
export type TextEntryReusedListQuery = z.output<
  typeof textEntryReusedListQuerySchema
>;
/** `GET /api/v1/entry_reuses`'s query parameters, as a client sends them. */
export type TextEntryReusedListParams = ListParams<
  typeof textEntryReusedListQuery,
  IncludePath<typeof RELATIONSHIPS, typeof TEXT_ENTRY_REUSED>
>;
