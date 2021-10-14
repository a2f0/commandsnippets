import {getParent, types} from 'mobx-state-tree';
import type {RootModel} from '../AppStateStore';

export interface IUserJsonApi {
  id: string;
  type: string;
  attributes: IUserJsonApiAttributes;
}

export interface IUserJsonApiAttributes {
  username: string;
}

const UserAttributes = types
  .model('UserAttributes', {
    username: types.string,
  })
  .actions(() => ({}));

export const UserModel = types
  .model('UserJsonApi', {
    id: types.identifier,
    type: types.string,
    attributes: UserAttributes,
  })
  .actions(self => ({
    update(object: IUserJsonApi) {
      Object.assign(self, object);
    },
    remove() {
      getParent<RootModel>(self, 2).removeTag(self.id);
    },
  }));
