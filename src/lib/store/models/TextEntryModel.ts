import {getParent, types} from 'mobx-state-tree';

import type {RootModel} from './RootModel';
import {getMostRecentTimeStamp} from '../../shared';
import {fetch, fetchPage, sort} from '../../text_entries';

export interface ITextEntryJsonApi {
  id: string;
  type: string;
  attributes: {
    body: string;
    subject: string;
    date_updated: string;
    date_created: string;
    reused_count: number;
    is_deleted: boolean;
    tag_count: number;
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
