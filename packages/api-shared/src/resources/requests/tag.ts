/** `Tag`'s requests (`/api/v1/tags`): documents and the collection's query. */
import * as z from 'zod/mini';
import {booleanField, charField} from '../../fields';
import {dateTimeFilter, textFilter} from '../../filters';
import {
  createDocumentSchema,
  noFieldsSchema,
  updateDocumentSchema,
} from '../../jsonapi/request';
import {listQuerySchema} from '../../query';
import {TAG} from '../types';
import {reorderAttributesSchema} from './reorder';

export const TAG_NAME_MAX_LENGTH = 24;

/**
 * POST: creates the tag, or returns the requester's tag of that (trimmed)
 * name, restoring it if it was deleted.
 */
export const tagCreateAttributesSchema = z.object({
  name: charField({maxLength: TAG_NAME_MAX_LENGTH}),
});

/** PATCH/PUT: rename, or (un)delete. */
export const tagUpdateAttributesSchema = z.partial(
  z.object({
    name: charField({maxLength: TAG_NAME_MAX_LENGTH}),
    is_deleted: booleanField(),
  })
);

export const tagCreateDocumentSchema = createDocumentSchema(TAG, {
  attributes: tagCreateAttributesSchema,
  relationships: noFieldsSchema,
});

export const tagUpdateDocumentSchema = updateDocumentSchema(TAG, {
  attributes: tagUpdateAttributesSchema,
  relationships: noFieldsSchema,
});

/** `POST /api/v1/tags/reorder`. */
export const tagReorderDocumentSchema = createDocumentSchema(TAG, {
  attributes: reorderAttributesSchema,
  relationships: noFieldsSchema,
});

export type TagCreateAttributes = z.output<typeof tagCreateAttributesSchema>;
export type TagUpdateAttributes = z.output<typeof tagUpdateAttributesSchema>;
export type TagCreateDocument = z.output<typeof tagCreateDocumentSchema>;
export type TagUpdateDocument = z.output<typeof tagUpdateDocumentSchema>;
export type TagReorderDocument = z.output<typeof tagReorderDocumentSchema>;

// The collection's query

export const TAG_SORT_FIELDS = [
  'date_last_used',
  'date_created',
  'date_updated',
  'entry_count',
  'name',
  'order',
] as const;

/** `filter[search]` is accepted and ignored. */
export const tagListQuerySchema = listQuerySchema({
  filters: {
    name: textFilter,
    user__username: textFilter,
    /** Sync: tags changed after a revision. */
    date_updated__gt: dateTimeFilter,
  },
  sort: TAG_SORT_FIELDS,
  search: 'ignored',
  include: 'resolved',
});

export type TagSortField = (typeof TAG_SORT_FIELDS)[number];
export type TagListQuery = z.output<typeof tagListQuerySchema>;
