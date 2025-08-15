export interface UserResponse {
  data: {
    attributes: {
      username: string;
    };
  };
}

import type {ITagTextEntryThroughModelJsonApi} from '../../store/models/TagTextEntryThroughModel';

export interface TagTextEntryThroughModelResponse {
  data: ITagTextEntryThroughModelJsonApi;
  included?: unknown[];
}
