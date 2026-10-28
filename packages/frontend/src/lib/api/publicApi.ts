/** The same sync reads as the owner/admin adapters, with public access pinned. */
import {
  CODES,
  DATA_ACCESS_HEADER,
  DATA_OWNER_ID_HEADER,
  PUBLIC_REVISION_HEADER,
} from '@commandsnippets/api-shared/messages';
import {dataOwnerDocumentSchema} from '@commandsnippets/api-shared/responses';
import type * as z from 'zod/mini';
import {PublicViewChangedError} from '../sync/publicView';
import type {SyncApi} from '../sync/sync';
import {fetchApi} from './apiVersion';
import {baseURL} from './baseUrl';
import {firstError} from './errorDocument';
import {parseBody, readJson} from './parseResponse';
import {urlWithQuery} from './searchParams';
import {syncReads} from './syncReads';

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
        // A body that is not JSON (a proxy's page, say) is no view change.
        const body: unknown = await response.json().catch(() => undefined);
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
    ...syncReads(async (path, params, schema) =>
      read(urlWithQuery(`${base}${path}`, params), schema)
    ),
  };
}
