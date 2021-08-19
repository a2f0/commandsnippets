import {fetch, sort} from '../lib/tags';
import {getParent, types} from 'mobx-state-tree';
import type {RootModel} from '../AppStateStore';

export interface ITagJsonApi {
  id: string;
  type: string;
  attributes: ITagJsonApiAttributes;
}

export interface ITagJsonApiAttributes {
  name: string;
  entry_count: number;
  order: number;
  date_updated: string;
  date_created: string;
  date_last_used: string;
}

const TagAtributes = types
  .model('TagAtributes', {
    name: types.string,
    entry_count: types.number,
    order: types.number,
    date_updated: types.string,
    date_created: types.string,
    date_last_used: types.string,
  })
  .actions(() => ({}));

export const TagModel = types
  .model('TagJsonAPI', {
    id: types.identifier,
    type: types.string,
    attributes: TagAtributes,
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
};
