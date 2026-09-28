import type {
  GithubLoginDocument,
  GoogleLoginDocument,
  TagCreateDocument,
  TagReorderDocument,
  TagTextEntryCreateDocument,
  TagTextEntryReorderDocument,
  TagUpdateDocument,
  TextEntryCreateDocument,
  TextEntryUpdateDocument,
} from '@commandsnippets/api-shared/requests';
import {
  emptyObjectSchema,
  type TagDocument,
  type TagListDocument,
  type TagTextEntryDocument,
  type TextEntryDocument,
  type TextEntryListDocument,
  tagDocumentSchema,
  tagListDocumentSchema,
  tagTextEntryDocumentSchema,
  textEntryDocumentSchema,
  textEntryListDocumentSchema,
  type UserDocument,
  userDocumentSchema,
} from '@commandsnippets/api-shared/responses';
import type {z} from 'zod';
import {baseHTTPURL, baseURL} from './baseUrl';
import {fetchWithAuth} from './fetchWithAuth';
import {parseBody, readJson} from './parseResponse';
import type {EntriesQueryParams, TagsQueryParams} from './requests/types';

type LogoutResponse = z.output<typeof emptyObjectSchema>;

type QueryValue = string | number | boolean | undefined;
type QueryParams<T> = {[K in keyof T]?: QueryValue};

/** Query parameters in their order, leaving out the undefined ones. */
function toSearchParams<T extends QueryParams<T>>(params: T): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries<QueryValue>(params)) {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  }
  return searchParams;
}

function urlWithQuery<T extends QueryParams<T>>(
  path: string,
  params: T
): string {
  const url = new URL(path);
  url.search = toSearchParams(params).toString();
  return url.toString();
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
   * call `fetch` directly.
   */
  withAuth?: boolean;
}

/**
 * The API client. Request bodies are api-shared's request documents, and
 * every response the client returns is parsed with its endpoint's document
 * schema first. An OK response that does not fit throws InvalidResponseError
 * (`${failure}: invalid response (...)`, see parseResponse.ts), so callers
 * handle it as a failed request and the store never sees the body. The calls
 * that return nothing (the logins, deletes and reorders) do not read it.
 */
class ApiClient {
  /**
   * Send a request with the auth cookie, which every route needs (reads
   * included, since they are owner-only and cross-origin). Throws
   * `${failure}: ${statusText}` unless the response is OK.
   */
  private async request(
    url: string,
    {
      method,
      body,
      signal,
      contentType = 'application/vnd.api+json',
      withAuth = true,
    }: RequestOptions,
    failure: string
  ): Promise<Response> {
    const init: RequestInit = {
      method,
      credentials: 'include',
      ...(signal ? {signal} : {}),
      headers: {'Content-Type': contentType},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    };
    const resp = withAuth
      ? await fetchWithAuth(url, init)
      : await fetch(url, init);
    if (!resp.ok) {
      throw new Error(`${failure}: ${resp.statusText}`);
    }
    return resp;
  }

  /** `request`, returning the JSON body parsed with the document `schema`. */
  private async requestDocument<S extends z.ZodType>(
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
  public async createTag(name: string): Promise<TagDocument> {
    const payload: TagCreateDocument = {
      data: {
        type: 'Tag',
        attributes: {
          name,
        },
      },
    };
    return this.requestDocument(
      `${baseURL}/tags`,
      {method: 'POST', body: payload},
      'Failed to create tag',
      tagDocumentSchema
    );
  }

  public async deleteTag(tagId: string): Promise<TagDocument> {
    return this.requestDocument(
      `${baseURL}/tags/${tagId}`,
      {method: 'DELETE'},
      'Failed to delete tag',
      tagDocumentSchema
    );
  }

  public async updateTag(tagId: string, name: string): Promise<TagDocument> {
    const payload: TagUpdateDocument = {
      data: {
        id: tagId,
        type: 'Tag',
        attributes: {name},
      },
    };
    return this.requestDocument(
      `${baseURL}/tags/${tagId}`,
      {method: 'PATCH', body: payload},
      'Failed to update tag',
      tagDocumentSchema
    );
  }

  // Entry methods
  public async createEntry(
    subject: string,
    body: string
  ): Promise<TextEntryDocument> {
    // The entry is the requester's: the API takes no `user` relationship.
    const payload: TextEntryCreateDocument = {
      data: {
        type: 'TextEntry',
        attributes: {
          subject,
          body,
        },
      },
    };
    return this.requestDocument(
      `${baseURL}/entries`,
      {method: 'POST', body: payload},
      'Failed to create entry',
      textEntryDocumentSchema
    );
  }

  public async updateEntry(
    entryId: string,
    subject: string,
    body: string
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
      {method: 'PATCH', body: payload},
      'Failed to update entry',
      textEntryDocumentSchema
    );
  }

  public async getEntries(
    params: EntriesQueryParams & {signal?: AbortSignal}
  ): Promise<TextEntryListDocument> {
    const {signal, ...queryParams} = params;
    return this.requestDocument(
      urlWithQuery(`${baseURL}/entries`, queryParams),
      {method: 'GET', signal},
      'Failed to fetch entries',
      textEntryListDocumentSchema
    );
  }

  public async getTags(params: TagsQueryParams): Promise<TagListDocument> {
    return this.requestDocument(
      urlWithQuery(`${baseURL}/tags`, params),
      {method: 'GET'},
      'Failed to fetch tags',
      tagListDocumentSchema
    );
  }

  public async tagEntry(
    tagId: string,
    entryId: string
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
      {method: 'POST', body: payload},
      'Failed to tag entry',
      tagTextEntryDocumentSchema
    );
  }

  public async untagEntry(tagEntryId: string): Promise<void> {
    await this.request(
      `${baseURL}/tags_entries/${tagEntryId}`,
      {method: 'DELETE'},
      'Failed to untag entry'
    );
  }

  public async deleteEntry(entryId: string): Promise<void> {
    await this.request(
      `${baseURL}/entries/${entryId}`,
      {method: 'DELETE'},
      'Failed to delete entry'
    );
  }

  public async reorderTag(payload: TagReorderDocument): Promise<void> {
    await this.request(
      `${baseURL}/tags/reorder`,
      {method: 'POST', body: payload},
      'Failed to reorder tag'
    );
  }

  public async reorderEntry(top: string, bottom: string): Promise<void> {
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
      {method: 'POST', body: payload},
      'Failed to reorder entry'
    );
  }
}

const apiClient = new ApiClient();

export {apiClient};
