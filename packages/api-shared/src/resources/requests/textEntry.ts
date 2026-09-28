/**
 * `TextEntry`'s requests (`/api/v1/entries`): documents and the collection's
 * query.
 */
import * as z from 'zod/mini';
import {booleanField, charField} from '../../fields';
import {
  booleanFilter,
  dateTimeFilter,
  integerFilter,
  textFilter,
} from '../../filters';
import {
  createDocumentSchema,
  noFieldsSchema,
  updateDocumentSchema,
} from '../../jsonapi/request';
import {listQuerySchema} from '../../query';
import {TEXT_ENTRY} from '../types';

export const TEXT_ENTRY_SUBJECT_MAX_LENGTH = 255;
export const TEXT_ENTRY_BODY_MAX_LENGTH = 1024;

/** POST. The entry is the requester's; a `user` relationship is ignored. */
export const textEntryCreateAttributesSchema = z.object({
  body: charField({maxLength: TEXT_ENTRY_BODY_MAX_LENGTH}),
  subject: charField({maxLength: TEXT_ENTRY_SUBJECT_MAX_LENGTH}),
});

/** PATCH/PUT: edit, or (un)delete. */
export const textEntryUpdateAttributesSchema = z.partial(
  z.object({
    body: charField({maxLength: TEXT_ENTRY_BODY_MAX_LENGTH}),
    subject: charField({maxLength: TEXT_ENTRY_SUBJECT_MAX_LENGTH}),
    is_deleted: booleanField(),
  })
);

export const textEntryCreateDocumentSchema = createDocumentSchema(TEXT_ENTRY, {
  attributes: textEntryCreateAttributesSchema,
  relationships: noFieldsSchema,
});

export const textEntryUpdateDocumentSchema = updateDocumentSchema(TEXT_ENTRY, {
  attributes: textEntryUpdateAttributesSchema,
  relationships: noFieldsSchema,
});

export type TextEntryCreateAttributes = z.output<
  typeof textEntryCreateAttributesSchema
>;
export type TextEntryUpdateAttributes = z.output<
  typeof textEntryUpdateAttributesSchema
>;
export type TextEntryCreateDocument = z.output<
  typeof textEntryCreateDocumentSchema
>;
export type TextEntryUpdateDocument = z.output<
  typeof textEntryUpdateDocumentSchema
>;

// The collection's query

export const TEXT_ENTRY_SORT_FIELDS = [
  'body',
  'date_created',
  'date_updated',
  'subject',
] as const;

/**
 * `filter[search]` matches the subject or body, case-insensitively
 * (Unicode-aware).
 */
export const textEntryListQuerySchema = listQuerySchema({
  filters: {
    id: integerFilter,
    tags__name: textFilter,
    tags__id: integerFilter,
    user__username: textFilter,
    tag_count: integerFilter,
    is_deleted: booleanFilter,
    /** Sync: entries changed after a revision. */
    date_updated__gt: dateTimeFilter,
  },
  sort: TEXT_ENTRY_SORT_FIELDS,
  search: 'supported',
  include: 'resolved',
});

export type TextEntrySortField = (typeof TEXT_ENTRY_SORT_FIELDS)[number];
export type TextEntryListQuery = z.output<typeof textEntryListQuerySchema>;
