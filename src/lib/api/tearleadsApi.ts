import type {ApiResponse} from './fetchBase';
import {ApiError, apiBase, baseHTTPURL, FetchApiClient} from './fetchBase';
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
    try {
      await apiBase.post('/google-login/', payload, {
        withCredentials: true,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Google authentication failed: ${error.message}`);
      }
      throw new Error(
        'Google authentication failed: An unknown error occurred'
      );
    }
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
    try {
      await apiBase.post('/github-login/', payload, {
        withCredentials: true,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`GitHub authentication failed: ${error.message}`);
      }
      throw new Error(
        'GitHub authentication failed: An unknown error occurred'
      );
    }
  }

  public async getCurrentUser(): Promise<ApiResponse<UserResponse>> {
    try {
      return await apiBase.get<UserResponse>('/user/', {
        withCredentials: true,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Failed to get current user: ${error.message}`);
      }
      throw new Error('Failed to get current user: An unknown error occurred');
    }
  }

  public async logout(): Promise<ApiResponse<unknown>> {
    const logoutApi = new FetchApiClient({
      baseURL: baseHTTPURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    try {
      return await logoutApi.post(
        '/api-token-deauth/',
        {},
        {withCredentials: true}
      );
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Logout failed: ${error.message}`);
      }
      throw new Error('Logout failed: An unknown error occurred');
    }
  }

  // Tag methods
  public async createTag(name: string): Promise<ApiResponse<unknown>> {
    const payload: TagPayload = {
      data: {
        type: 'Tag',
        attributes: {
          name,
        },
      },
    };
    try {
      return await apiBase.post('/tags', payload, {
        withCredentials: true,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Failed to create tag: ${error.message}`);
      }
      throw new Error('Failed to create tag: An unknown error occurred');
    }
  }

  public async deleteTag(tagId: string): Promise<ApiResponse<unknown>> {
    try {
      return await apiBase.delete(`/tags/${tagId}`, {
        withCredentials: true,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Failed to delete tag: ${error.message}`);
      }
      throw new Error('Failed to delete tag: An unknown error occurred');
    }
  }

  // Entry methods
  public async createEntry(
    subject: string,
    body: string,
    userId: string
  ): Promise<ApiResponse<unknown>> {
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
    try {
      return await apiBase.post('/entries', payload, {
        withCredentials: true,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Failed to create entry: ${error.message}`);
      }
      throw new Error('Failed to create entry: An unknown error occurred');
    }
  }

  public async updateEntry(
    entryId: string,
    subject: string,
    body: string
  ): Promise<ApiResponse<unknown>> {
    const payload: EntryUpdatePayload = {
      data: {
        type: 'TextEntry',
        attributes: {
          subject,
          body,
        },
      },
    };
    try {
      return await apiBase.patch(`entries/${entryId}`, payload, {
        withCredentials: true,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Failed to update entry: ${error.message}`);
      }
      throw new Error('Failed to update entry: An unknown error occurred');
    }
  }

  public async getEntries(
    params: EntriesQueryParams & {signal?: AbortSignal}
  ): Promise<ApiResponse<unknown>> {
    try {
      const {signal, ...queryParams} = params;
      return await apiBase.get('/entries', {
        params: queryParams as unknown as Record<
          string,
          string | number | boolean | undefined
        >,
        ...(signal && {signal}),
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Failed to get entries: ${error.message}`);
      }
      throw new Error('Failed to get entries: An unknown error occurred');
    }
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
    try {
      return await apiBase.post<{data: unknown}>('/tags_entries', payload, {
        withCredentials: true,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Failed to tag entry: ${error.message}`);
      }
      throw new Error('Failed to tag entry: An unknown error occurred');
    }
  }

  public async untagEntry(tagEntryId: string): Promise<void> {
    try {
      await apiBase.delete(`/tags_entries/${tagEntryId}`, {
        withCredentials: true,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Failed to untag entry: ${error.message}`);
      }
      throw new Error('Failed to untag entry: An unknown error occurred');
    }
  }

  // Reorder methods (existing)
  public async reorderTag(payload: ReorderTag): Promise<void> {
    try {
      await apiBase.post('/tags/reorder', payload, {
        withCredentials: true,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        // Preserve the original error with all its context
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Failed to reorder tag: ${error.message}`);
      }
      throw new Error('Failed to reorder tag: An unknown error occurred');
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
    try {
      await apiBase.post('/tags_entries/reorder', payload, {
        withCredentials: true,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new Error(`Failed to reorder entry: ${error.message}`);
      }
      throw new Error('Failed to reorder entry: An unknown error occurred');
    }
  }
}

const tearleadsApi = new TearleadsApi();

export {tearleadsApi};
