import {getParent, types} from 'mobx-state-tree';
import type {RootModel} from '../AppStateStore';

export interface IUserJsonApi {
  id: string;
  type: string;
  attributes: {
    username: string;
    date_updated: string;
  };
}

const UserAttributes = types
  .model('UserAttributes', {
    username: types.string,
    date_updated: types.string,
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
