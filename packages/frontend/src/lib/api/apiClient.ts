import {
  CLIENT_UPDATED_HEADER,
  CLIENT_WRITE_ID_HEADER,
  CODES,
  DATA_VERSION_HEADER,
  EXPECTED_USER_HEADER,
  EXPECTED_USER_ID_HEADER,
} from '@commandsnippets/api-shared/messages';
import type {
  GithubLoginDocument,
  GoogleLoginDocument,
  TagCreateDocument,
  TagListParams,
  TagReorderDocument,
  TagTextEntryCreateDocument,
  TagTextEntryListParams,
  TagTextEntryReorderDocument,
  TagUpdateDocument,
  TextEntryCreateDocument,
  TextEntryListParams,
  TextEntryUpdateDocument,
} from '@commandsnippets/api-shared/requests';
import {
  type Backup,
  backupSchema,
  type DataVersionDocument,
  type DataVersionListDocument,
  dataVersionDocumentSchema,
  dataVersionListDocumentSchema,
  emptyObjectSchema,
  type RestoreResult,
  restoreResultSchema,
  type TagCursorListDocument,
  type TagDocument,
  type TagTextEntryCursorListDocument,
  type TagTextEntryDocument,
  type TagTextEntryListDocument,
  type TextEntryCursorListDocument,
  type TextEntryDocument,
  tagCursorListDocumentSchema,
  tagDocumentSchema,
  tagTextEntryCursorListDocumentSchema,
  tagTextEntryDocumentSchema,
  tagTextEntryListDocumentSchema,
  textEntryCursorListDocumentSchema,
  textEntryDocumentSchema,
  textEntryListDocumentSchema,
  type UserDocument,
  userDocumentSchema,
} from '@commandsnippets/api-shared/responses';
import type * as z from 'zod/mini';
import {signedInUser} from '../auth/authUtils';
import {SYNC_PAGE_SIZE} from '../sync/pageSize';
import {fetchApi} from './apiVersion';
import {baseHTTPURL, baseURL} from './baseUrl';
import {firstError} from './errorDocument';
import {fetchWithAuth} from './fetchWithAuth';
import {parseBody, readJson} from './parseResponse';
import {urlWithQuery} from './searchParams';

type LogoutResponse = z.output<typeof emptyObjectSchema>;

/**
 * A request the API answered with an error status (`${failure}:
 * ${statusText}`), which says whether trying it again can help: a queued
 * write (`lib/sync/outbox.ts`) is retried after a network failure or a 5xx,
 * and dropped after a 4xx. `detail` is the first error's, when the answer
 * was an error document (`errorDocument.ts`): why a backup was refused, say.
 */
export class ApiRequestError extends Error {
  constructor(
    failure: string,
    readonly status: number,
    statusText: string,
    readonly detail?: string
  ) {
    super(`${failure}: ${statusText}`);
    this.name = 'ApiRequestError';
  }
}

/**
 * A write the API refused because the request is signed in as another user
 * than the one it named (`EXPECTED_USER_HEADER`): another tab has signed in
 * as someone else since this one did.
 */
export class UserMismatchError extends Error {
  constructor(
    failure: string,
    readonly username: string
  ) {
    super(`${failure}: the session is not ${username}'s`);
    this.name = 'UserMismatchError';
  }
}

/**
 * A request the API refused because the data version it named
 * (`DATA_VERSION_HEADER`) is no longer the user's active one (409
 * `data_version_changed`): a backup was restored, or another version made
 * active, since this copy of the data was read. The copy is cleared and
 * synced again (`lib/sync/dataVersion.ts`).
 */
export class DataVersionChangedError extends Error {
  constructor(failure: string) {
    super(`${failure}: the data version changed`);
    this.name = 'DataVersionChangedError';
  }
}

interface RequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Sent as JSON. */
  body?: unknown;
  signal?: AbortSignal | undefined;
  contentType?: 'application/vnd.api+json' | 'application/json';
  /**
   * Whether an answer that means the session is gone signs the user out
   * (`fetchWithAuth`). The logins run before there is a session, so they
   * call `fetchApi` directly.
   */
  withAuth?: boolean;
  /**
   * When a queued write was made (`CLIENT_UPDATED_HEADER`): the API applies
   * it only when no newer write to the row has (last writer wins).
   */
  made?: string | undefined;
}

/**
 * The API client. Request bodies are api-shared's request documents, and
 * every response the client returns is parsed with its endpoint's document
 * schema first. An OK response that does not fit throws InvalidResponseError
 * (`${failure}: invalid response (...)`, see parseResponse.ts), so callers
 * handle it as a failed request and the store never sees the body. The calls
 * that return nothing (the logins, deletes and reorders) do not read it.
 */
/** Whom and what a client's requests name (see the methods setting each). */
interface ClientOptions {
  /** The user every write names (`writesAs`), read at each request. */
  actingUser: () => string | null;
  /** The queued write the writes name (`forWrite`). */
  writeId: string | null;
  /** Whether reads name the acting user too (`writesAs`'s). */
  readsAsUser: boolean;
  /** The account (user id) every request names (`forAccount`). */
  accountId: string | null;
  /** The data version every request names (`forVersion`). */
  dataVersion: number | null;
}

class ApiClient {
  constructor(
    private readonly options: ClientOptions = {
      actingUser: signedInUser,
      writeId: null,
      readsAsUser: false,
      accountId: null,
      dataVersion: null,
    }
  ) {}

  private with(changes: Partial<ClientOptions>): ApiClient {
    return new ApiClient({...this.options, ...changes});
  }

  /**
   * A client whose requests always name `username`, whoever is signed in
   * when they are sent: a queue of `username`'s writes
   * (`lib/sync/outbox.ts`) is refused (`UserMismatchError`) rather than
   * written into another user's account when this tab has switched accounts
   * meanwhile, and so are the reads it makes (restores, a reorder's rows),
   * rather than storing the other user's rows as `username`'s.
   */
  public writesAs(username: string): ApiClient {
    return this.with({actingUser: () => username, readsAsUser: true});
  }

  /**
   * A client whose writes name the queued write `writeId`
   * (`CLIENT_WRITE_ID_HEADER`), the same on every attempt to send it.
   */
  public forWrite(writeId: string): ApiClient {
    return this.with({writeId});
  }

  /**
   * A client whose requests name the account `userId` too
   * (`EXPECTED_USER_ID_HEADER`): refused (`UserMismatchError`) when signed
   * in as another account, though of the same username (the first deleted,
   * its name taken again).
   */
  public forAccount(userId: string): ApiClient {
    return this.with({accountId: userId});
  }

  /**
   * A client whose requests name the data version `version`
   * (`DATA_VERSION_HEADER`): the one the rows they read and write are of,
   * refused (`DataVersionChangedError`) once another is active.
   */
  public forVersion(version: number): ApiClient {
    return this.with({dataVersion: version});
  }

  /**
   * Send a request with the auth cookie, which every route needs (reads
   * included, since they are owner-only and cross-origin), naming the acting
   * user in a write. Throws `UserMismatchError` when the API refuses a write
   * as another user's, else `${failure}: ${statusText}` unless the response
   * is OK.
   */
  private async request(
    url: string,
    {
      method,
      body,
      signal,
      contentType = 'application/vnd.api+json',
      withAuth = true,
      made,
    }: RequestOptions,
    failure: string
  ): Promise<Response> {
    // Writes name the signed-in user: the API refuses one signed in as
    // anyone else (`UserMismatchError`).
    const {actingUser, writeId, readsAsUser, accountId, dataVersion} =
      this.options;
    const user =
      withAuth && (method !== 'GET' || readsAsUser) ? actingUser() : null;
    const init: RequestInit = {
      method,
      credentials: 'include',
      ...(signal ? {signal} : {}),
      headers: {
        'Content-Type': contentType,
        ...(user === null
          ? {}
          : {[EXPECTED_USER_HEADER]: encodeURIComponent(user)}),
        ...(user === null || accountId === null
          ? {}
          : {[EXPECTED_USER_ID_HEADER]: accountId}),
        ...(dataVersion === null
          ? {}
          : {[DATA_VERSION_HEADER]: String(dataVersion)}),
        ...(made === undefined ? {} : {[CLIENT_UPDATED_HEADER]: made}),
        ...(writeId === null || method === 'GET'
          ? {}
          : {[CLIENT_WRITE_ID_HEADER]: writeId}),
      },
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    };
    const resp = withAuth
      ? await fetchWithAuth(url, init)
      : await fetchApi(url, init);
    if (!resp.ok) {
      const body: unknown = await resp.json().catch(() => undefined);
      const {code, detail} = firstError(body);
      if (user !== null && resp.status === 409 && code === CODES.userMismatch) {
        throw new UserMismatchError(failure, user);
      }
      if (resp.status === 409 && code === CODES.dataVersionChanged) {
        throw new DataVersionChangedError(failure);
      }
      throw new ApiRequestError(failure, resp.status, resp.statusText, detail);
    }
    return resp;
  }

  /** `request`, returning the JSON body parsed with the document `schema`. */
  private async requestDocument<S extends z.ZodMiniType>(
    url: string,
    options: RequestOptions,
    failure: string,
    schema: S
  ): Promise<z.output<S>> {
    const resp = await this.request(url, options, failure);
    return parseBody(schema, await readJson(resp, failure), failure);
  }

  // Authentication methods
  public async googleLogin(code: string): Promise<void> {
    const payload: GoogleLoginDocument = {
      data: {
        type: 'GoogleLogin',
        attributes: {
          code,
        },
      },
    };
    await this.request(
      `${baseURL}/google-login/`,
      {method: 'POST', body: payload, withAuth: false},
      'Google login failed'
    );
  }

  public async githubLogin(code: string): Promise<void> {
    const payload: GithubLoginDocument = {
      data: {
        type: 'GithubLogin',
        attributes: {code},
      },
    };
    await this.request(
      `${baseURL}/github-login/`,
      {method: 'POST', body: payload, withAuth: false},
      'GitHub login failed'
    );
  }

  public async getCurrentUser(): Promise<UserDocument> {
    return this.requestDocument(
      `${baseURL}/user/`,
      {method: 'GET'},
      'Failed to fetch user',
      userDocumentSchema
    );
  }

  /**
   * A backup of the user's data (`GET /user/backup`): every tag, entry,
   * tagging and reuse not deleted, with its id, of their active data version
   * or of `version`.
   */
  public async getBackup(version?: number): Promise<Backup> {
    return this.requestDocument(
      `${baseURL}/user/backup${version === undefined ? '' : `?version=${version}`}`,
      {method: 'GET'},
      'Failed to export backup',
      backupSchema
    );
  }

  /** The user's data versions, newest first (`GET /user/data_versions`). */
  public async getDataVersions(): Promise<DataVersionListDocument> {
    return this.requestDocument(
      `${baseURL}/user/data_versions`,
      {method: 'GET'},
      'Failed to list data versions',
      dataVersionListDocumentSchema
    );
  }

  /** Make data version `version` the user's active one. */
  public async activateDataVersion(
    version: number
  ): Promise<DataVersionDocument> {
    return this.requestDocument(
      `${baseURL}/user/data_versions/${version}/activate`,
      {method: 'POST', body: {}, contentType: 'application/json'},
      'Failed to switch data versions',
      dataVersionDocumentSchema
    );
  }

  /** Delete data version `version` (one not active), rows and all. */
  public async deleteDataVersion(version: number): Promise<void> {
    await this.request(
      `${baseURL}/user/data_versions/${version}`,
      {method: 'DELETE'},
      'Failed to delete data version'
    );
  }

  /**
   * Make `backup`'s data the user's, as a new data version made active
   * (`POST /user/restore`): its number, and how many of each the restore
   * made. A backup the API refuses is an `ApiRequestError` whose `detail`
   * says why.
   */
  public async restoreBackup(backup: Backup): Promise<RestoreResult> {
    return this.requestDocument(
      `${baseURL}/user/restore`,
      {method: 'POST', body: backup, contentType: 'application/json'},
      'Failed to restore backup',
      restoreResultSchema
    );
  }

  public async logout(): Promise<LogoutResponse> {
    const failure = 'Logout failed';
    const resp = await this.request(
      `${baseHTTPURL}/api-token-deauth/`,
      {method: 'POST', body: {}, contentType: 'application/json'},
      failure
    );
    // The API answers `{}`; an OK logout with no body at all is one too.
    return parseBody(
      emptyObjectSchema,
      await readJson(resp, failure, {}),
      failure
    );
  }

  // Tag methods
  // Writes: `made` is when a queued write was made (see RequestOptions).

  public async createTag(
    name: string,
    clientId?: string,
    made?: string
  ): Promise<TagDocument> {
    const payload: TagCreateDocument = {
      data: {
        type: 'Tag',
        attributes: {
          name,
          ...(clientId === undefined ? {} : {client_id: clientId}),
        },
      },
    };
    return this.requestDocument(
      `${baseURL}/tags`,
      {method: 'POST', body: payload, made},
      'Failed to create tag',
      tagDocumentSchema
    );
  }

  public async deleteTag(tagId: string, made?: string): Promise<TagDocument> {
    return this.requestDocument(
      `${baseURL}/tags/${tagId}`,
      {method: 'DELETE', made},
      'Failed to delete tag',
      tagDocumentSchema
    );
  }

  /** Keep tag `tagId`, bringing it back if deleted (unless a newer write). */
  public async keepTag(tagId: string, made?: string): Promise<TagDocument> {
    const payload: TagUpdateDocument = {
      data: {id: tagId, type: 'Tag', attributes: {is_deleted: false}},
    };
    return this.requestDocument(
      `${baseURL}/tags/${tagId}`,
      {method: 'PATCH', body: payload, made},
      'Failed to keep tag',
      tagDocumentSchema
    );
  }

  public async updateTag(
    tagId: string,
    name: string,
    made?: string
  ): Promise<TagDocument> {
    const payload: TagUpdateDocument = {
      data: {
        id: tagId,
        type: 'Tag',
        attributes: {name},
      },
    };
    return this.requestDocument(
      `${baseURL}/tags/${tagId}`,
      {method: 'PATCH', body: payload, made},
      'Failed to update tag',
      tagDocumentSchema
    );
  }

  // Entry methods
  public setTagPublic(
    tagId: string,
    isPublic: boolean,
    made?: string
  ): Promise<TagDocument> {
    const payload: TagUpdateDocument = {
      data: {type: 'Tag', id: tagId, attributes: {is_public: isPublic}},
    };
    return this.requestDocument(
      `${baseURL}/tags/${tagId}`,
      {method: 'PATCH', body: payload, made},
      'Failed to change tag visibility',
      tagDocumentSchema
    );
  }

  public setEntryPublic(
    entryId: string,
    isPublic: boolean,
    made?: string
  ): Promise<TextEntryDocument> {
    const payload: TextEntryUpdateDocument = {
      data: {type: 'TextEntry', id: entryId, attributes: {is_public: isPublic}},
    };
    return this.requestDocument(
      `${baseURL}/entries/${entryId}`,
      {method: 'PATCH', body: payload, made},
      'Failed to change entry visibility',
      textEntryDocumentSchema
    );
  }

  /**
   * Create an entry. `clientId` makes a retried create find the entry the
   * first one made (`client_id`).
   */
  public async createEntry(
    subject: string,
    body: string,
    clientId?: string,
    made?: string
  ): Promise<TextEntryDocument> {
    // The entry is the requester's: the API takes no `user` relationship.
    const payload: TextEntryCreateDocument = {
      data: {
        type: 'TextEntry',
        attributes: {
          subject,
          body,
          ...(clientId === undefined ? {} : {client_id: clientId}),
        },
      },
    };
    return this.requestDocument(
      `${baseURL}/entries`,
      {method: 'POST', body: payload, made},
      'Failed to create entry',
      textEntryDocumentSchema
    );
  }

  public async updateEntry(
    entryId: string,
    subject: string,
    body: string,
    made?: string
  ): Promise<TextEntryDocument> {
    const payload: TextEntryUpdateDocument = {
      data: {
        id: entryId,
        type: 'TextEntry',
        attributes: {
          subject,
          body,
        },
      },
    };
    return this.requestDocument(
      `${baseURL}/entries/${entryId}`,
      {method: 'PATCH', body: payload, made},
      'Failed to update entry',
      textEntryDocumentSchema
    );
  }

  // The sync's reads (lib/sync/): keyset pages in revision order.

  /** The page of the user's tags after `after`. */
  public async getTagsAfter(after: string): Promise<TagCursorListDocument> {
    const params: TagListParams = {
      'page[after]': after,
      'page[size]': SYNC_PAGE_SIZE,
    };
    return this.requestDocument(
      urlWithQuery(`${baseURL}/tags`, params),
      {method: 'GET'},
      'Failed to sync tags',
      tagCursorListDocumentSchema
    );
  }

  /** The page of the user's entries after `after`, with their junctions. */
  public async getEntriesAfter(
    after: string
  ): Promise<TextEntryCursorListDocument> {
    const params: TextEntryListParams = {
      'page[after]': after,
      'page[size]': SYNC_PAGE_SIZE,
      include: 'text_entry_to_tag',
    };
    return this.requestDocument(
      urlWithQuery(`${baseURL}/entries`, params),
      {method: 'GET'},
      'Failed to sync entries',
      textEntryCursorListDocumentSchema
    );
  }

  /** All entry rows (deleted ones too), for the first load's page total. */
  public async getEntryCount(): Promise<number> {
    const params: TextEntryListParams = {'page[size]': 1};
    const page = await this.requestDocument(
      urlWithQuery(`${baseURL}/entries`, params),
      {method: 'GET'},
      'Failed to count entries',
      textEntryListDocumentSchema
    );
    return page.meta.pagination.count;
  }

  /**
   * The page of tag `tagId`'s junctions (deleted ones too) after `after`,
   * with their entries and the entries' junctions.
   */
  public async getTagJunctionsAfter(
    tagId: string,
    after: string
  ): Promise<TagTextEntryCursorListDocument> {
    const params: TagTextEntryListParams = {
      'filter[tag.id]': Number(tagId),
      'page[after]': after,
      'page[size]': SYNC_PAGE_SIZE,
      include: 'text_entry,text_entry.text_entry_to_tag',
    };
    return this.requestDocument(
      urlWithQuery(`${baseURL}/tags_entries`, params),
      {method: 'GET'},
      'Failed to sync tag',
      tagTextEntryCursorListDocumentSchema
    );
  }

  /** The user's newest junction revision, of any tag's (none: null). */
  public async getNewestJunction(): Promise<TagTextEntryListDocument> {
    const params: TagTextEntryListParams = {
      sort: '-date_updated',
      'page[size]': 1,
    };
    return this.requestDocument(
      urlWithQuery(`${baseURL}/tags_entries`, params),
      {method: 'GET'},
      'Failed to read the newest junction',
      tagTextEntryListDocumentSchema
    );
  }

  public async tagEntry(
    tagId: string,
    entryId: string,
    made?: string
  ): Promise<TagTextEntryDocument> {
    const payload: TagTextEntryCreateDocument = {
      data: {
        type: 'TagTextEntryThroughModel',
        attributes: {},
        relationships: {
          tag: {
            data: {
              id: tagId,
              type: 'Tag',
            },
          },
          text_entry: {
            data: {
              id: entryId,
              type: 'TextEntry',
            },
          },
        },
      },
    };
    return this.requestDocument(
      `${baseURL}/tags_entries`,
      {method: 'POST', body: payload, made},
      'Failed to tag entry',
      tagTextEntryDocumentSchema
    );
  }

  /** Untag: the junction, deleted (or as it stands, after a newer write). */
  public async untagEntry(
    tagEntryId: string,
    made?: string
  ): Promise<TagTextEntryDocument> {
    return this.requestDocument(
      `${baseURL}/tags_entries/${tagEntryId}`,
      {method: 'DELETE', made},
      'Failed to untag entry',
      tagTextEntryDocumentSchema
    );
  }

  /** Delete: the entry, deleted (or as it stands, after a newer write). */
  public async deleteEntry(
    entryId: string,
    made?: string
  ): Promise<TextEntryDocument> {
    return this.requestDocument(
      `${baseURL}/entries/${entryId}`,
      {method: 'DELETE', made},
      'Failed to delete entry',
      textEntryDocumentSchema
    );
  }

  public async reorderTag(
    payload: TagReorderDocument,
    made?: string
  ): Promise<void> {
    await this.request(
      `${baseURL}/tags/reorder`,
      {method: 'POST', body: payload, made},
      'Failed to reorder tag'
    );
  }

  public async reorderEntry(
    top: string,
    bottom: string,
    made?: string
  ): Promise<void> {
    const payload: TagTextEntryReorderDocument = {
      data: {
        type: 'TagTextEntryThroughModel',
        attributes: {
          top,
          bottom,
        },
        relationships: {},
      },
    };
    await this.request(
      `${baseURL}/tags_entries/reorder`,
      {method: 'POST', body: payload, made},
      'Failed to reorder entry'
    );
  }

  // Single rows, to put back what a refused queued write changed locally.

  public async getTag(tagId: string): Promise<TagDocument> {
    return this.requestDocument(
      `${baseURL}/tags/${tagId}`,
      {method: 'GET'},
      'Failed to fetch tag',
      tagDocumentSchema
    );
  }

  public async getEntry(entryId: string): Promise<TextEntryDocument> {
    return this.requestDocument(
      `${baseURL}/entries/${entryId}`,
      {method: 'GET'},
      'Failed to fetch entry',
      textEntryDocumentSchema
    );
  }

  /** The junction (deleted too) putting entry `entryId` in tag `tagId`. */
  public async getJunction(
    tagId: string,
    entryId: string
  ): Promise<TagTextEntryListDocument> {
    const params: TagTextEntryListParams = {
      'filter[tag.id]': Number(tagId),
      'filter[text_entry.id]': Number(entryId),
    };
    return this.requestDocument(
      urlWithQuery(`${baseURL}/tags_entries`, params),
      {method: 'GET'},
      'Failed to fetch junction',
      tagTextEntryListDocumentSchema
    );
  }
}

const apiClient = new ApiClient();

export {apiClient};
