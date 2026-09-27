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

class TearleadsApi {
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
    const resp = await fetch(`${baseURL}/google-login/`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      throw new Error(`Google login failed: ${resp.statusText}`);
    }
  }

  public async integratedOAuthLogin(
    provider: string,
    token: string
  ): Promise<void> {
    const payload = {
      data: {
        type: 'IntegratedOAuthLogin',
        attributes: {
          provider,
          token,
        },
      },
    };

    const resp = await fetch(`${baseURL}/integrated-oauth/`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(
        `Integrated OAuth login failed: ${resp.statusText} - ${errorText}`
      );
    }
  }

  public async githubLogin(
    code: string,
    clientType: 'web' | 'electron' = 'web'
  ): Promise<void> {
    const payload: AuthPayload = {
      data: {
        type: 'GithubLogin',
        attributes: {
          code,
          clientType,
        },
      },
    };
    const resp = await fetch(`${baseURL}/github-login/`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      throw new Error(`GitHub login failed: ${resp.statusText}`);
    }
  }

  public async getCurrentUser(): Promise<UserResponse> {
    const resp = await fetchWithAuth(`${baseURL}/user/`, {
      method: 'GET',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
    });
    if (!resp.ok) {
      throw new Error(`Failed to fetch user: ${resp.statusText}`);
    }
    const json = await resp.json();
    if (isUserResponse(json)) {
      return json;
    }
    throw new Error('Invalid user response');
  }

  public async logout(): Promise<LogoutResponse> {
    const resp = await fetchWithAuth(`${baseHTTPURL}/api-token-deauth/`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({}),
    });

    if (!resp.ok) {
      throw new Error(`Logout failed: ${resp.statusText}`);
    }

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
    const resp = await fetchWithAuth(`${baseURL}/tags`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      throw new Error(`Failed to create tag: ${resp.statusText}`);
    }
    return resp.json() as Promise<ITagJsonApiResponseSingle>;
  }

  public async deleteTag(tagId: string): Promise<ITagJsonApiResponseSingle> {
    const resp = await fetchWithAuth(`${baseURL}/tags/${tagId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
    });
    if (!resp.ok) {
      throw new Error(`Failed to delete tag: ${resp.statusText}`);
    }
    return resp.json() as Promise<ITagJsonApiResponseSingle>;
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
    const resp = await fetchWithAuth(`${baseURL}/tags/${tagId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      throw new Error(`Failed to update tag: ${resp.statusText}`);
    }
    return resp.json() as Promise<ITagJsonApiResponseSingle>;
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
    const resp = await fetchWithAuth(`${baseURL}/entries`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      throw new Error(`Failed to create entry: ${resp.statusText}`);
    }
    return resp.json() as Promise<ITextEntryJsonApiResponseSingle>;
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
    const resp = await fetchWithAuth(`${baseURL}/entries/${entryId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      throw new Error(`Failed to update entry: ${resp.statusText}`);
    }
    return resp.json() as Promise<ITextEntryJsonApiResponseSingle>;
  }

  public async getEntries(
    params: EntriesQueryParams & {signal?: AbortSignal}
  ): Promise<ITextEntryJsonApiResponse> {
    const {signal, ...queryParams} = params;
    const url = new URL(`${baseURL}/entries`);
    Object.entries(
      queryParams as Record<string, string | number | boolean | undefined>
    ).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.append(key, String(value));
    });
    const resp = await fetchWithAuth(url.toString(), {
      method: 'GET',
      // Reads are owner-only, so they must carry the auth cookie cross-origin.
      credentials: 'include',
      ...(signal ? {signal} : {}),
      headers: {'Content-Type': 'application/vnd.api+json'},
    });
    if (!resp.ok) {
      throw new Error(`Failed to fetch entries: ${resp.statusText}`);
    }
    return resp.json() as Promise<ITextEntryJsonApiResponse>;
  }

  public async getTags(params: TagsQueryParams): Promise<ITagJsonApiResponse> {
    const url = new URL(`${baseURL}/tags`);
    Object.entries(
      params as unknown as Record<string, string | number | boolean | undefined>
    ).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.append(key, String(value));
    });
    const resp = await fetchWithAuth(url.toString(), {
      method: 'GET',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
    });
    if (!resp.ok) {
      throw new Error(`Failed to fetch tags: ${resp.statusText}`);
    }
    return resp.json() as Promise<ITagJsonApiResponse>;
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
    const resp = await fetchWithAuth(`${baseURL}/tags_entries`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      throw new Error(`Failed to tag entry: ${resp.statusText}`);
    }
    return resp.json() as Promise<TagTextEntryThroughModelResponse>;
  }

  public async untagEntry(tagEntryId: string): Promise<void> {
    const resp = await fetchWithAuth(`${baseURL}/tags_entries/${tagEntryId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
    });
    if (!resp.ok) {
      throw new Error(`Failed to untag entry: ${resp.statusText}`);
    }
  }

  public async deleteEntry(entryId: string): Promise<void> {
    const resp = await fetchWithAuth(`${baseURL}/entries/${entryId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
    });
    if (!resp.ok) {
      throw new Error(`Failed to delete entry: ${resp.statusText}`);
    }
  }

  public async reorderTag(payload: ReorderTag): Promise<void> {
    const resp = await fetchWithAuth(`${baseURL}/tags/reorder`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      throw new Error(`Failed to reorder tag: ${resp.statusText}`);
    }
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
    const resp = await fetchWithAuth(`${baseURL}/tags_entries/reorder`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      throw new Error(`Failed to reorder entry: ${resp.statusText}`);
    }
  }
}

const tearleadsApi = new TearleadsApi();

export {tearleadsApi};
