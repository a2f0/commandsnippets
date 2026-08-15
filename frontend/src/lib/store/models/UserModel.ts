import {getParent, types} from 'mobx-state-tree';

import type {RootModel} from './RootModel';

export interface IUserJsonApi {
  id: string;
  type: string;
  attributes: {
    username: string;
    date_updated: string;
  };
}

export const UserModel = types
  .model('UserJsonApi', {
    id: types.identifier,
    type: types.string,
    attributes: types
      .model('UserAttributes', {
        username: types.string,
        date_updated: types.string,
      })
      .actions(() => ({})),
  })
  .actions(self => ({
    update(object: IUserJsonApi) {
      Object.assign(self, object);
    },
    remove() {
      getParent<typeof RootModel>(self, 2).removeTag(self.id);
    },
  }));
