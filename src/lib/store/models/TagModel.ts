import {getParent, types} from 'mobx-state-tree';
import {getMostRecentTimeStamp} from '../../shared';
import {fetch, filterAndSort} from '../../tags';
import type {RootModel} from './RootModel';

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

export const TagModel = types
  .model('TagJsonAPI', {
    id: types.identifier,
    type: types.string,
    attributes: types
      .model('TagAtributes', {
        name: types.string,
        entry_count: types.number,
        order: types.number,
        date_updated: types.string,
        date_created: types.string,
        date_last_used: types.string,
        is_deleted: types.boolean,
      })
      .actions(() => ({})),
    relationships: types
      .model('UserRelationships', {
        user: types
          .model('TagRelationshipsUser', {
            data: types
              .model('TagRelationshipsUserData', {
                id: types.string,
                type: types.string,
              })
              .actions(() => ({})),
          })
          .actions(() => ({})),
      })
      .actions(() => ({})),
  })
  .actions(self => ({
    update(object: ITagJsonApi) {
      Object.assign(self, object);
    },
    remove() {
      getParent<typeof RootModel>(self, 2).removeTag(self.id);
    },
  }));

export const TagHelpers = {
  filterAndSort,
  fetch,
  getMostRecentTimeStamp,
};
