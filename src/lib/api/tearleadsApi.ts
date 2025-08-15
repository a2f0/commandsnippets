import {baseHTTPURL, baseURL} from './baseUrl';
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
    await fetch(`${baseURL}/google-login/`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
  }

  public async githubLogin(code: string): Promise<void> {
    const payload: AuthPayload = {
      data: {
        type: 'GithubLogin',
        attributes: {
          code,
        },
      },
    };
    await fetch(`${baseURL}/github-login/`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
  }

  public async getCurrentUser(): Promise<UserResponse> {
    const resp = await fetch(`${baseURL}/user/`, {
      method: 'GET',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
    });
    const json = await resp.json();
    if (isUserResponse(json)) {
      return json;
    }
    throw new Error('Invalid user response');
  }

  public async logout(): Promise<unknown> {
    const resp = await fetch(`${baseHTTPURL}/api-token-deauth/`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({}),
    });
    try {
      return await resp.json();
    } catch {
      return undefined;
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
    const resp = await fetch(`${baseURL}/tags`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
    return resp.json() as Promise<ITagJsonApiResponseSingle>;
  }

  public async deleteTag(tagId: string): Promise<ITagJsonApiResponseSingle> {
    const resp = await fetch(`${baseURL}/tags/${tagId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
    });
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
    const resp = await fetch(`${baseURL}/tags/${tagId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
    return resp.json() as Promise<ITagJsonApiResponseSingle>;
  }

  // Entry methods
  public async createEntry(
    subject: string,
    body: string,
    userId: string
  ): Promise<ITextEntryJsonApiResponse> {
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
    const resp = await fetch(`${baseURL}/entries`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
    return resp.json() as Promise<ITextEntryJsonApiResponse>;
  }

  public async updateEntry(
    entryId: string,
    subject: string,
    body: string
  ): Promise<ITextEntryJsonApiResponse> {
    const payload: EntryUpdatePayload = {
      data: {
        type: 'TextEntry',
        attributes: {
          subject,
          body,
        },
      },
    };
    const resp = await fetch(`${baseURL}/entries/${entryId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
    return resp.json() as Promise<ITextEntryJsonApiResponse>;
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
    const resp = await fetch(url.toString(), {
      method: 'GET',
      ...(signal ? {signal} : {}),
      headers: {'Content-Type': 'application/vnd.api+json'},
    });
    return resp.json() as Promise<ITextEntryJsonApiResponse>;
  }

  public async getTags(params: TagsQueryParams): Promise<ITagJsonApiResponse> {
    const url = new URL(`${baseURL}/tags`);
    Object.entries(
      params as unknown as Record<string, string | number | boolean | undefined>
    ).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.append(key, String(value));
    });
    const resp = await fetch(url.toString(), {
      method: 'GET',
      headers: {'Content-Type': 'application/vnd.api+json'},
    });
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
    const resp = await fetch(`${baseURL}/tags_entries`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
    return resp.json() as Promise<TagTextEntryThroughModelResponse>;
  }

  public async untagEntry(tagEntryId: string): Promise<void> {
    await fetch(`${baseURL}/tags_entries/${tagEntryId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
    });
  }

  public async reorderTag(payload: ReorderTag): Promise<void> {
    await fetch(`${baseURL}/tags/reorder`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
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
    await fetch(`${baseURL}/tags_entries/reorder`, {
      method: 'POST',
      credentials: 'include',
      headers: {'Content-Type': 'application/vnd.api+json'},
      body: JSON.stringify(payload),
    });
  }
}

const tearleadsApi = new TearleadsApi();

export {tearleadsApi};
