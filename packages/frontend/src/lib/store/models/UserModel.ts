import {getParent, types} from 'mobx-state-tree';

import type {IUserJsonApi} from '../../api/responses/types';
import type {RootModel} from './RootModel';

export const UserModel = types
  .model('UserJsonApi', {
    id: types.identifier,
    type: types.literal('User'),
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
      getParent<typeof RootModel>(self, 2).removeUser(self.id);
    },
  }));
