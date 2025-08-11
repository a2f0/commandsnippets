import {ApiError, apiBase} from './fetchBase';

export interface ReorderTag {
  data: {
    type: 'Tag';
    attributes: {
      top: string;
      bottom: string;
    };
    relationships: Record<string, never>;
  };
}

interface ReorderEntry {
  data: {
    type: 'TagTextEntryThroughModel';
    attributes: {
      top: string;
      bottom: string;
    };
    relationships: Record<string, never>;
  };
}

class TearleadsApi {
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
    } catch (error) {
      console.error('Failed to reorder entry:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new Error('Failed to reorder entry');
    }
  }
}

const tearleadsApi = new TearleadsApi();

export {tearleadsApi};
