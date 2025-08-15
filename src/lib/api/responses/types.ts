export interface UserResponse {
  data: {
    attributes: {
      username: string;
    };
  };
}

import type {ITagJsonApi} from '../../store/models/TagModel';
import type {ITagTextEntryThroughModelJsonApi} from '../../store/models/TagTextEntryThroughModel';
import type {ITextEntryJsonApi} from '../../store/models/TextEntryModel';
import type {IUserJsonApi} from '../../store/models/UserModel';

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
