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
}

const tearleadsApi = new TearleadsApi();

export {tearleadsApi};
