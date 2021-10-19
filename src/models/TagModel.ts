import {fetch, getMostRecentTimeStamp, sort} from '../lib/tags';
import {getParent, types} from 'mobx-state-tree';
import type {RootModel} from '../AppStateStore';

export interface ITagJsonApi {
  id: string;
  type: string;
  attributes: ITagJsonApiAttributes;
  relationships: ITagJsonApiRelationships;
}

export interface ITagJsonApiAttributes {
  name: string;
  entry_count: number;
  order: number;
  date_updated: string;
  date_created: string;
  date_last_used: string;
  is_deleted: boolean;
}

interface ITagJsonApiRelationships {
  user: ITagJsonApiRelationshipsUser;
}

interface ITagJsonApiRelationshipsUser {
  data: ITagJsonApiRelationshipsUserData;
}

interface ITagJsonApiRelationshipsUserData {
  id: string;
  type: string;
}

const TagAtributes = types
  .model('TagAtributes', {
    name: types.string,
    entry_count: types.number,
    order: types.number,
    date_updated: types.string,
    date_created: types.string,
    date_last_used: types.string,
    is_deleted: types.boolean,
  })
  .actions(() => ({}));

const TagRelationshipsUserData = types
  .model('TagRelationshipsUserData', {
    id: types.string,
    type: types.string,
  })
  .actions(() => ({}));

const TagRelationshipsUser = types
  .model('TagRelationshipsUser', {
    data: TagRelationshipsUserData,
  })
  .actions(() => ({}));

const UserRelationships = types
  .model('UserRelationships', {
    user: TagRelationshipsUser,
  })
  .actions(() => ({}));

export const TagModel = types
  .model('TagJsonAPI', {
    id: types.identifier,
    type: types.string,
    attributes: TagAtributes,
    relationships: UserRelationships,
  })
  .actions(self => ({
    update(object: ITagJsonApi) {
      Object.assign(self, object);
    },
    remove() {
      getParent<RootModel>(self, 2).removeTag(self.id);
    },
  }));

export const TagHelpers = {
  sort: sort,
  fetch: fetch,
  getMostRecentTimeStamp,
};
