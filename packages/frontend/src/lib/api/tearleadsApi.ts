import {baseHTTPURL, baseURL} from './baseUrl';
import {fetchWithAuth} from './fetchWithAuth';
import type {
  AuthPayload,
  EntriesQueryParams,
  EntryPayload,
  EntryUpdatePayload,
  ReorderEntry,
  ReorderTag,
  TagEntryPayload,
  TagPayload,
  TagsQueryParams,
} from './requests/types';
import {isUserResponse} from './responses/typeGuards';
import type {
  ITagJsonApiResponse,
  ITagJsonApiResponseSingle,
  ITextEntryJsonApiResponse,
  ITextEntryJsonApiResponseSingle,
  LogoutResponse,
  TagTextEntryThroughModelResponse,
  UserResponse,
} from './responses/types';

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
   * Whether a 403 signs the user out (`fetchWithAuth`). The logins run
   * before there is a session, so they call `fetch` directly.
   */
  withAuth?: boolean;
}

class TearleadsApi {
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

  /** `request`, returning the JSON body as the API documents it (unchecked). */
  private async requestJson<T>(
    url: string,
    options: RequestOptions,
    failure: string
  ): Promise<T> {
    const resp = await this.request(url, options, failure);
    return resp.json() as Promise<T>;
  }

  // Authentication methods
  public async googleLogin(code: string): Promise<void> {
    const payload: AuthPayload = {
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
    const payload: AuthPayload = {
      data: {
        type: 'GithubLogin',
        // The Django backend requires clientType until it is removed;
        // backend-v2 ignores it.
        attributes: {code, clientType: 'web'},
      },
    };
    await this.request(
      `${baseURL}/github-login/`,
      {method: 'POST', body: payload, withAuth: false},
      'GitHub login failed'
    );
  }

  public async getCurrentUser(): Promise<UserResponse> {
    const resp = await this.request(
      `${baseURL}/user/`,
      {method: 'GET'},
      'Failed to fetch user'
    );
    const json = await resp.json();
    if (isUserResponse(json)) {
      return json;
    }
    throw new Error('Invalid user response');
  }

  public async logout(): Promise<LogoutResponse> {
    const resp = await this.request(
      `${baseHTTPURL}/api-token-deauth/`,
      {method: 'POST', body: {}, contentType: 'application/json'},
      'Logout failed'
    );

    try {
      return await resp.json();
    } catch {
      // Handle cases where response is OK but body is empty or not valid JSON
      return {};
    }
  }

  // Tag methods
  public async createTag(name: string): Promise<ITagJsonApiResponseSingle> {
    const payload: TagPayload = {
      data: {
        type: 'Tag',
        attributes: {
          name,
        },
      },
    };
    return this.requestJson(
      `${baseURL}/tags`,
      {method: 'POST', body: payload},
      'Failed to create tag'
    );
  }

  public async deleteTag(tagId: string): Promise<ITagJsonApiResponseSingle> {
    return this.requestJson(
      `${baseURL}/tags/${tagId}`,
      {method: 'DELETE'},
      'Failed to delete tag'
    );
  }

  public async updateTag(
    tagId: string,
    name: string
  ): Promise<ITagJsonApiResponseSingle> {
    const payload = {
      data: {
        id: tagId,
        type: 'Tag',
        attributes: {name},
      },
    };
    return this.requestJson(
      `${baseURL}/tags/${tagId}`,
      {method: 'PATCH', body: payload},
      'Failed to update tag'
    );
  }

  // Entry methods
  public async createEntry(
    subject: string,
    body: string,
    userId: string
  ): Promise<ITextEntryJsonApiResponseSingle> {
    const payload: EntryPayload = {
      data: {
        type: 'TextEntry',
        attributes: {
          subject,
          body,
        },
        relationships: {
          user: {
            data: {
              id: userId,
              type: 'User',
            },
          },
        },
      },
    };
    return this.requestJson(
      `${baseURL}/entries`,
      {method: 'POST', body: payload},
      'Failed to create entry'
    );
  }

  public async updateEntry(
    entryId: string,
    subject: string,
    body: string
  ): Promise<ITextEntryJsonApiResponseSingle> {
    const payload: EntryUpdatePayload = {
      data: {
        id: entryId,
        type: 'TextEntry',
        attributes: {
          subject,
          body,
        },
      },
    };
    return this.requestJson(
      `${baseURL}/entries/${entryId}`,
      {method: 'PATCH', body: payload},
      'Failed to update entry'
    );
  }

  public async getEntries(
    params: EntriesQueryParams & {signal?: AbortSignal}
  ): Promise<ITextEntryJsonApiResponse> {
    const {signal, ...queryParams} = params;
    return this.requestJson(
      urlWithQuery(`${baseURL}/entries`, queryParams),
      {method: 'GET', signal},
      'Failed to fetch entries'
    );
  }

  public async getTags(params: TagsQueryParams): Promise<ITagJsonApiResponse> {
    return this.requestJson(
      urlWithQuery(`${baseURL}/tags`, params),
      {method: 'GET'},
      'Failed to fetch tags'
    );
  }

  public async tagEntry(
    tagId: string,
    entryId: string
  ): Promise<TagTextEntryThroughModelResponse> {
    const payload: TagEntryPayload = {
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
    return this.requestJson(
      `${baseURL}/tags_entries`,
      {method: 'POST', body: payload},
      'Failed to tag entry'
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

  public async reorderTag(payload: ReorderTag): Promise<void> {
    await this.request(
      `${baseURL}/tags/reorder`,
      {method: 'POST', body: payload},
      'Failed to reorder tag'
    );
  }

  public async reorderEntry(top: string, bottom: string): Promise<void> {
    const payload: ReorderEntry = {
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

const tearleadsApi = new TearleadsApi();

export {tearleadsApi};
