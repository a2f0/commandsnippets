import type {ITagJsonApi} from '../../store/models/TagModel';
import type {ITagTextEntryThroughModelJsonApi} from '../../store/models/TagTextEntryThroughModel';
import type {ITextEntryJsonApi} from '../../store/models/TextEntryModel';
import type {IUserJsonApi} from '../../store/models/UserModel';
import type {UserResponse} from './types';

export function isUserResponse(response: unknown): response is UserResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'data' in response &&
    typeof response.data === 'object' &&
    response.data !== null &&
    'attributes' in response.data &&
    typeof response.data.attributes === 'object' &&
    response.data.attributes !== null &&
    'username' in response.data.attributes &&
    typeof response.data.attributes.username === 'string'
  );
}

export function isAUser(
  obj:
    | ITextEntryJsonApi
    | ITagTextEntryThroughModelJsonApi
    | IUserJsonApi
    | ITagJsonApi
): obj is IUserJsonApi {
  return obj.type === 'User';
}

export function isATag(
  obj:
    | ITextEntryJsonApi
    | ITagTextEntryThroughModelJsonApi
    | IUserJsonApi
    | ITagJsonApi
): obj is ITagJsonApi {
  return obj.type === 'Tag';
}

export function isATextEntry(
  obj:
    | ITextEntryJsonApi
    | ITagTextEntryThroughModelJsonApi
    | IUserJsonApi
    | ITagJsonApi
): obj is ITextEntryJsonApi {
  return obj.type === 'TextEntry';
}

export function isAJunction(
  obj:
    | ITextEntryJsonApi
    | ITagTextEntryThroughModelJsonApi
    | IUserJsonApi
    | ITagJsonApi
): obj is ITagTextEntryThroughModelJsonApi {
  return obj.type === 'TagTextEntryThroughModel';
}
