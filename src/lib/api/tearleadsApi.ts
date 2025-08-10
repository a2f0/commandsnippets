import {apiBase} from './fetchBase';

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
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('An unknown error occurred');
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
    await apiBase
      .post('/tags_entries/reorder', payload, {
        withCredentials: true,
      })
      .catch(error => {
        console.error(error);
      });
  }
}

const tearleadsApi = new TearleadsApi();

export {tearleadsApi};
