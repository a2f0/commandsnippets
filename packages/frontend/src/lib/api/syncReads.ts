/**
 * The sync's reads (`lib/sync/`): keyset pages in revision order, the same
 * from every client (`apiClient`'s, `adminSyncApi`'s, `publicSyncApi`'s),
 * which supplies only how it sends them (`SyncRead`).
 */
import type {
  TagListParams,
  TagTextEntryListParams,
  TextEntryListParams,
} from '@commandsnippets/api-shared/requests';
import {
  tagCursorListDocumentSchema,
  tagTextEntryCursorListDocumentSchema,
  tagTextEntryListDocumentSchema,
  textEntryCursorListDocumentSchema,
  textEntryListDocumentSchema,
} from '@commandsnippets/api-shared/responses';
import type * as z from 'zod/mini';
import {SYNC_PAGE_SIZE} from '../sync/pageSize';
import type {SyncApi} from '../sync/sync';

/**
 * A client's GET of the collection `path` (`/tags`, `/entries` or
 * `/tags_entries`, under whichever user's routes the client reads) with the
 * query `params`, returning the body parsed with `schema`. `failure` is what
 * a failed read says it was doing, for a client whose errors say so.
 */
export type SyncRead = <S extends z.ZodMiniType>(
  path: string,
  params: TagListParams | TextEntryListParams | TagTextEntryListParams,
  schema: S,
  failure: string
) => Promise<z.output<S>>;

export type SyncReads = Pick<
  SyncApi,
  | 'getTagsAfter'
  | 'getEntriesAfter'
  | 'getEntryCount'
  | 'getTagJunctionsAfter'
  | 'getNewestJunction'
>;

/** The sync's reads, sent by `read`. */
export function syncReads(read: SyncRead): SyncReads {
  return {
    // The page of the tags after `after`.
    getTagsAfter: after =>
      read(
        '/tags',
        {
          'page[after]': after,
          'page[size]': SYNC_PAGE_SIZE,
        } satisfies TagListParams,
        tagCursorListDocumentSchema,
        'Failed to sync tags'
      ),
    // The page of the entries after `after`, with their junctions.
    getEntriesAfter: after =>
      read(
        '/entries',
        {
          'page[after]': after,
          'page[size]': SYNC_PAGE_SIZE,
          include: 'text_entry_to_tag',
        } satisfies TextEntryListParams,
        textEntryCursorListDocumentSchema,
        'Failed to sync entries'
      ),
    // All entry rows (deleted ones too), for the first load's page total.
    getEntryCount: async () =>
      (
        await read(
          '/entries',
          {'page[size]': 1} satisfies TextEntryListParams,
          textEntryListDocumentSchema,
          'Failed to count entries'
        )
      ).meta.pagination.count,
    // The page of tag `tagId`'s junctions (deleted ones too) after `after`,
    // with their entries and the entries' junctions.
    getTagJunctionsAfter: (tagId, after) =>
      read(
        '/tags_entries',
        {
          'filter[tag.id]': Number(tagId),
          'page[after]': after,
          'page[size]': SYNC_PAGE_SIZE,
          include: 'text_entry,text_entry.text_entry_to_tag',
        } satisfies TagTextEntryListParams,
        tagTextEntryCursorListDocumentSchema,
        'Failed to sync tag'
      ),
    // The newest junction revision, of any tag's (none: null).
    getNewestJunction: () =>
      read(
        '/tags_entries',
        {
          sort: '-date_updated',
          'page[size]': 1,
        } satisfies TagTextEntryListParams,
        tagTextEntryListDocumentSchema,
        'Failed to read the newest junction'
      ),
  };
}
