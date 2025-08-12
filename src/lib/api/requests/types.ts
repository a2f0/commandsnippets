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

export interface ReorderEntry {
  data: {
    type: 'TagTextEntryThroughModel';
    attributes: {
      top: string;
      bottom: string;
    };
    relationships: Record<string, never>;
  };
}

export interface TagPayload {
  data: {
    type: 'Tag';
    attributes: {
      name: string;
    };
  };
}

export interface EntryPayload {
  data: {
    type: 'TextEntry';
    attributes: {
      subject: string;
      body: string;
    };
    relationships: {
      user: {
        data: {
          id: string;
          type: 'User';
        };
      };
    };
  };
}

export interface EntryUpdatePayload {
  data: {
    type: 'TextEntry';
    attributes: {
      subject: string;
      body: string;
    };
  };
}

export interface TagEntryPayload {
  data: {
    type: 'TagTextEntryThroughModel';
    attributes: Record<string, never>;
    relationships: {
      tag: {
        data: {
          id: string;
          type: 'Tag';
        };
      };
      text_entry: {
        data: {
          id: string;
          type: 'TextEntry';
        };
      };
    };
  };
}

export interface AuthPayload {
  data: {
    type: 'GoogleLogin' | 'GithubLogin';
    attributes: {
      code: string;
    };
  };
}

export interface EntriesQueryParams {
  'page[number]'?: number;
  'filter[user.username]'?: string;
  'filter[tags.name]'?: string;
  'filter[date_updated.gt]'?: string;
  'filter[untagged]'?: boolean;
  'filter[term]'?: string;
  'filter[tag_count]'?: number;
  'filter[search]'?: string;
  sort?: string;
  include?: string;
  page?: {
    limit?: number;
    offset?: number;
  };
}
