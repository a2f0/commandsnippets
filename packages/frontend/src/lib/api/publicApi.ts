/** The same sync reads as the owner/admin adapters, with public access pinned. */
import {
  CODES,
  DATA_ACCESS_HEADER,
  DATA_OWNER_ID_HEADER,
  PUBLIC_REVISION_HEADER,
} from '@commandsnippets/api-shared/messages';
import type {
  TagListParams,
  TagTextEntryListParams,
  TextEntryListParams,
} from '@commandsnippets/api-shared/requests';
import {
  dataOwnerDocumentSchema,
  tagCursorListDocumentSchema,
  tagTextEntryCursorListDocumentSchema,
  tagTextEntryListDocumentSchema,
  textEntryCursorListDocumentSchema,
  textEntryListDocumentSchema,
} from '@commandsnippets/api-shared/responses';
import type * as z from 'zod/mini';
import {SYNC_PAGE_SIZE} from '../sync/pageSize';
import {PublicViewChangedError} from '../sync/publicView';
import type {SyncApi} from '../sync/sync';
import {fetchApi} from './apiVersion';
import {baseURL} from './baseUrl';
import {firstError} from './errorDocument';
import {parseBody, readJson} from './parseResponse';
import {urlWithQuery} from './searchParams';

export function publicSyncApi(username: string): SyncApi {
  const base = `${baseURL}/users/${encodeURIComponent(username)}`;
  let revision: number | undefined;
  let ownerId: string | undefined;
  async function read<S extends z.ZodMiniType>(
    url: string,
    schema: S,
    metadata = false
  ): Promise<z.output<S>> {
    const response = await fetchApi(url, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        [DATA_ACCESS_HEADER]: 'public',
        ...(!metadata && revision !== undefined
          ? {[PUBLIC_REVISION_HEADER]: String(revision)}
          : {}),
        ...(!metadata && ownerId !== undefined
          ? {[DATA_OWNER_ID_HEADER]: ownerId}
          : {}),
      },
    });
    if (!response.ok) {
      if (response.status === 404) throw new PublicViewChangedError(false);
      if (response.status === 409) {
        const body: unknown = await response.json();
        if (firstError(body).code === CODES.viewChanged)
          throw new PublicViewChangedError();
      }
      throw new Error(`Public data request failed: ${response.status}`);
    }
    return parseBody(
      schema,
      await readJson(response, 'Read public data'),
      'Read public data'
    );
  }
  return {
    getOwner: async () => {
      const {data} = await read(base, dataOwnerDocumentSchema, true);
      revision = data.attributes.public_revision;
      ownerId = data.id;
      return {
        id: data.id,
        username: data.attributes.username,
        publicRevision: revision,
      };
    },
    getTagsAfter: after => {
      const params: TagListParams = {
        'page[after]': after,
        'page[size]': SYNC_PAGE_SIZE,
      };
      return read(
        urlWithQuery(`${base}/tags`, params),
        tagCursorListDocumentSchema
      );
    },
    getEntriesAfter: after => {
      const params: TextEntryListParams = {
        'page[after]': after,
        'page[size]': SYNC_PAGE_SIZE,
        include: 'text_entry_to_tag',
      };
      return read(
        urlWithQuery(`${base}/entries`, params),
        textEntryCursorListDocumentSchema
      );
    },
    getEntryCount: async () => {
      const params: TextEntryListParams = {'page[size]': 1};
      return (
        await read(
          urlWithQuery(`${base}/entries`, params),
          textEntryListDocumentSchema
        )
      ).meta.pagination.count;
    },
    getTagJunctionsAfter: (tagId, after) => {
      const params: TagTextEntryListParams = {
        'filter[tag.id]': Number(tagId),
        'page[after]': after,
        'page[size]': SYNC_PAGE_SIZE,
        include: 'text_entry,text_entry.text_entry_to_tag',
      };
      return read(
        urlWithQuery(`${base}/tags_entries`, params),
        tagTextEntryCursorListDocumentSchema
      );
    },
    getNewestJunction: () => {
      const params: TagTextEntryListParams = {
        sort: '-date_updated',
        'page[size]': 1,
      };
      return read(
        urlWithQuery(`${base}/tags_entries`, params),
        tagTextEntryListDocumentSchema
      );
    },
  };
}
