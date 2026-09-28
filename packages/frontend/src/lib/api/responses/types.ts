// The JSON:API resources as the API sends them (the store's models in
// src/lib/store/models/ keep this shape), then the response bodies.

export interface ITagJsonApi {
  id: string;
  type: string;
  attributes: {
    name: string;
    entry_count: number;
    order: number;
    date_updated: string;
    date_created: string;
    date_last_used: string;
    is_deleted: boolean;
  };
  relationships: {
    user: {
      data: {
        id: string;
        type: string;
      };
    };
  };
}

export interface ITextEntryJsonApi {
  id: string;
  type: string;
  attributes: {
    body: string;
    subject: string;
    date_updated: string;
    date_created: string;
    reused_count: number;
    is_deleted: boolean;
    tag_count: number;
  };
  relationships: {
    user: {
      data: {
        id: string;
        type: string;
      };
    };
  };
}

export interface ITagTextEntryThroughModelJsonApi {
  id: string;
  type: string;
  attributes: {
    order: number;
    date_updated: string;
    date_created: string;
  };
  relationships: {
    tag: {
      data: {
        id: string;
        type: string;
      };
    };
    text_entry: {
      data: {
        id: string;
        type: string;
      };
    };
  };
}

export interface IUserJsonApi {
  id: string;
  type: string;
  attributes: {
    username: string;
    date_updated: string;
  };
}

export interface UserResponse {
  data: {
    attributes: {
      username: string;
      is_staff?: boolean;
    };
  };
}

export interface LogoutResponse extends Record<string, never> {}

export interface TagTextEntryThroughModelResponse {
  data: ITagTextEntryThroughModelJsonApi;
  included?: unknown[];
}

export interface ITagJsonApiResponse {
  data: ITagJsonApi[];
  links: {
    next: string | null;
  };
  included?: Array<IUserJsonApi>;
}

export interface ITagJsonApiResponseSingle {
  data: ITagJsonApi;
  included: Array<IUserJsonApi>;
}

export interface ITextEntryJsonApiResponse {
  data: Array<ITextEntryJsonApi>;
  links: {
    next: string | null;
  };
  included: Array<
    | ITagTextEntryThroughModelJsonApi
    | ITextEntryJsonApi
    | ITagJsonApi
    | IUserJsonApi
    | ITagJsonApi
  >;
}

export interface ITextEntryJsonApiResponseSingle {
  data: ITextEntryJsonApi;
  included: Array<ITagTextEntryThroughModelJsonApi>;
}
