import type {ITagJsonApiResponse} from '../tags';
import type {ITextEntryJsonApiResponse} from '../text_entries';
import {baseHTTPURL} from './baseUrl';
import type {ApiResponse} from './fetchBase';
import {ApiError, apiBase, FetchApiClient} from './fetchBase';
import type {
  AuthPayload,
  EntriesQueryParams,
  EntryPayload,
  EntryUpdatePayload,
  ReorderEntry,
  ReorderTag,
  TagEntryPayload,
  TagPayload,
} from './requests/types';
import type {UserResponse} from './responses/types';

// Re-export types for backward compatibility
export type {
  AuthPayload,
  EntriesQueryParams,
  EntryPayload,
  EntryUpdatePayload,
  ReorderEntry,
  ReorderTag,
  TagEntryPayload,
  TagPayload,
} from './requests/types';
export type {UserResponse} from './responses/types';

class TearleadsApi {
  private handleError(error: unknown, operation: string): never {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new Error(`${operation}: ${error.message}`);
    }
    throw new Error(`${operation}: An unknown error occurred`);
  }

  private async apiCall<T>(
    operation: string,
    apiCall: () => Promise<T>
  ): Promise<T> {
    try {
      return await apiCall();
    } catch (error: unknown) {
      this.handleError(error, operation);
    }
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
    await this.apiCall('Google authentication failed', () =>
      apiBase.post('/google-login/', payload, {
        withCredentials: true,
      })
    );
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
    await this.apiCall('GitHub authentication failed', () =>
      apiBase.post('/github-login/', payload, {
        withCredentials: true,
      })
    );
  }

  public async getCurrentUser(): Promise<ApiResponse<UserResponse>> {
    return this.apiCall('Failed to get current user', () =>
      apiBase.get<UserResponse>('/user/', {
        withCredentials: true,
      })
    );
  }

  public async logout(): Promise<ApiResponse<unknown>> {
    const logoutApi = new FetchApiClient({
      baseURL: baseHTTPURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return this.apiCall('Logout failed', () =>
      logoutApi.post('/api-token-deauth/', {}, {withCredentials: true})
    );
  }

  // Tag methods
  public async createTag(
    name: string
  ): Promise<ApiResponse<ITagJsonApiResponse>> {
    const payload: TagPayload = {
      data: {
        type: 'Tag',
        attributes: {
          name,
        },
      },
    };
    return this.apiCall('Failed to create tag', () =>
      apiBase.post('/tags', payload, {
        withCredentials: true,
      })
    );
  }

  public async deleteTag(tagId: string): Promise<ApiResponse<unknown>> {
    return this.apiCall('Failed to delete tag', () =>
      apiBase.delete(`/tags/${tagId}`, {
        withCredentials: true,
      })
    );
  }

  // Entry methods
  public async createEntry(
    subject: string,
    body: string,
    userId: string
  ): Promise<ApiResponse<ITextEntryJsonApiResponse>> {
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
    return this.apiCall('Failed to create entry', () =>
      apiBase.post('/entries', payload, {
        withCredentials: true,
      })
    );
  }

  public async updateEntry(
    entryId: string,
    subject: string,
    body: string
  ): Promise<ApiResponse<ITextEntryJsonApiResponse>> {
    const payload: EntryUpdatePayload = {
      data: {
        type: 'TextEntry',
        attributes: {
          subject,
          body,
        },
      },
    };
    return this.apiCall('Failed to update entry', () =>
      apiBase.patch(`entries/${entryId}`, payload, {
        withCredentials: true,
      })
    );
  }

  public async getEntries(
    params: EntriesQueryParams & {signal?: AbortSignal}
  ): Promise<ApiResponse<ITextEntryJsonApiResponse>> {
    const {signal, ...queryParams} = params;
    return this.apiCall('Failed to get entries', () =>
      apiBase.get('/entries', {
        params: queryParams as unknown as Record<
          string,
          string | number | boolean | undefined
        >,
        ...(signal && {signal}),
      })
    );
  }

  // Tag-Entry relationship methods
  public async tagEntry(
    tagId: string,
    entryId: string
  ): Promise<ApiResponse<{data: unknown}>> {
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
    return this.apiCall('Failed to tag entry', () =>
      apiBase.post<{data: unknown}>('/tags_entries', payload, {
        withCredentials: true,
      })
    );
  }

  public async untagEntry(tagEntryId: string): Promise<void> {
    await this.apiCall('Failed to untag entry', () =>
      apiBase.delete(`/tags_entries/${tagEntryId}`, {
        withCredentials: true,
      })
    );
  }

  // Reorder methods (existing)
  public async reorderTag(payload: ReorderTag): Promise<void> {
    await this.apiCall('Failed to reorder tag', () =>
      apiBase.post('/tags/reorder', payload, {
        withCredentials: true,
      })
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
    await this.apiCall('Failed to reorder entry', () =>
      apiBase.post('/tags_entries/reorder', payload, {
        withCredentials: true,
      })
    );
  }
}

const tearleadsApi = new TearleadsApi();

export {tearleadsApi};
