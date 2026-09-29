import {getParent, types} from 'mobx-state-tree';
import type {ITagJsonApi} from '../../api/responses/types';
import {fetch, filterAndSort} from '../../tags';
import type {RootModel} from './RootModel';

export const TagModel = types
  .model('TagJsonAPI', {
    id: types.identifier,
    type: types.literal('Tag'),
    attributes: types
      .model('TagAtributes', {
        name: types.string,
        entry_count: types.number,
        order: types.number,
        date_updated: types.string,
        date_created: types.string,
        // Null for a tag never used (older snapshots always hold a string).
        date_last_used: types.maybeNull(types.string),
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
                type: types.literal('User'),
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
};
