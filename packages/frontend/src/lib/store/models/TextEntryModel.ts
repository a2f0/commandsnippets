import {getParent, types} from 'mobx-state-tree';
import type {ITextEntryJsonApi} from '../../api/responses/types';
import {getMostRecentTimeStamp} from '../../shared';
import {fetch, fetchPage, sort} from '../../textEntries';
import type {RootModel} from './RootModel';

export const TextEntryModel = types
  .model('TextEntryJsonApi', {
    id: types.identifier,
    type: types.string,
    attributes: types
      .model('TextEntryAttributes', {
        body: types.string,
        subject: types.string,
        date_updated: types.string,
        date_created: types.string,
        reused_count: types.number,
        is_deleted: types.boolean,
        tag_count: types.number,
      })
      .actions(() => ({})),
    relationships: types
      .model('TextEntryRelationships', {
        user: types
          .model('TextEntryRelationshipsUser', {
            data: types
              .model('TextEntryRelationshipsUserData', {
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
    update(object: ITextEntryJsonApi) {
      Object.assign(self, object);
    },
    remove() {
      getParent<typeof RootModel>(self, 2).removeTextEntry(self.id);
    },
  }));

export const TextEntryHelpers = {
  sort,
  fetch,
  fetchPage,
  getMostRecentTimeStamp,
};
