import {fetch, fetchPage, sort} from '../lib/text_entries';
import {getParent, types} from 'mobx-state-tree';
import type {RootModel} from '../AppStateStore';
import {getMostRecentTimeStamp} from '../lib/shared';

export interface ITextEntryJsonApi {
  id: string;
  type: string;
  attributes: ITextEntryJsonApiAttributes;
  relationships: {
    user: ITextEntryJsonApiRelationshipsUser;
  };
}

export interface ITextEntryJsonApiAttributes {
  body: string;
  subject: string;
  date_updated: string;
  date_created: string;
  reused_count: number;
  is_deleted: boolean;
  tag_count: number;
}

interface ITextEntryJsonApiRelationshipsUser {
  data: ITextEntryJsonApiRelationshipsUserData;
}

interface ITextEntryJsonApiRelationshipsUserData {
  id: string;
  type: string;
}

interface ITextEntryJsonApiRelationshipsUser {
  data: ITextEntryJsonApiRelationshipsUserData;
}

const TextEntryAttributes = types
  .model('TextEntryAttributes', {
    body: types.string,
    subject: types.string,
    date_updated: types.string,
    date_created: types.string,
    reused_count: types.number,
    is_deleted: types.boolean,
    tag_count: types.number,
  })
  .actions(() => ({}));

const TextEntryRelationshipsUserData = types
  .model('TextEntryRelationshipsUserData', {
    id: types.string,
    type: types.string,
  })
  .actions(() => ({}));

const TextEntryRelationshipsUser = types
  .model('TextEntryRelationshipsUser', {
    data: TextEntryRelationshipsUserData,
  })
  .actions(() => ({}));

const TextEntryRelationships = types
  .model('TextEntryRelationships', {
    user: TextEntryRelationshipsUser,
  })
  .actions(() => ({}));

export const TextEntryModel = types
  .model('TextEntryJsonApi', {
    id: types.identifier,
    type: types.string,
    attributes: TextEntryAttributes,
    relationships: TextEntryRelationships,
  })
  .actions(self => ({
    update(object: ITextEntryJsonApi) {
      Object.assign(self, object);
    },
    remove() {
      getParent<RootModel>(self, 2).removeTextEntry(self.id);
    },
  }));

export const TextEntryHelpers = {
  sort,
  fetch,
  fetchPage,
  getMostRecentTimeStamp,
};
