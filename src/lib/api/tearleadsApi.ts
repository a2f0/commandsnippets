import apiBase from './apiBase';

export interface ReorderTag {
  data: {
    type: 'Tag';
    attributes: {
      top: string;
      bottom: string;
    };
    relationships: {};
  };
}

interface ReorderEntry {
  data: {
    type: 'TagTextEntryThroughModel';
    attributes: {
      top: string;
      bottom: string;
    };
    relationships: {};
  };
}

class TearleadsApi {
  public async reorderTag(payload: ReorderTag): Promise<void> {
    try {
      await apiBase.post('/tags/reorder', payload, {
        withCredentials: true,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      throw new Error(error);
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
