import {getParent, types} from 'mobx-state-tree';
import type {RootModel} from '../AppStateStore';

export interface ITagTextEntryThroughModelJsonApi {
  id: string;
  type: string;
  attributes: {
    order: number;
    date_updated: string;
    date_created: string;
  };
  relationships: {
    tag: {
      data: {
        id: string;
        type: string;
      };
    };
    text_entry: {
      data: {
        id: string;
        type: string;
      };
    };
  };
}

const TagTextEntryThroughModelAttributes = types
  .model('TagTextEntryThroughModelAttributes', {
    order: types.number,
    date_updated: types.string,
    date_created: types.string,
  })
  .actions(() => ({}));

const TagTextEntryThroughModelJsonApiRelationshipsTagData = types
  .model('TagTextEntryThroughModelJsonApiRelationshipsTagData', {
    id: types.string,
    type: types.string,
  })
  .actions(() => ({}));

const TagTextEntryThroughModelRelationshipsTag = types
  .model('TagTextEntryThroughModelRelationshipsTag ', {
    data: TagTextEntryThroughModelJsonApiRelationshipsTagData,
  })
  .actions(() => ({}));

const TagTextEntryThroughModelJsonApiRelationshipsTextEntryData = types
  .model('TagTextEntryThroughModelJsonApiRelationshipsTextEntryData', {
    id: types.string,
    type: types.string,
  })
  .actions(() => ({}));

const TagTextEntryThroughModelRelationshipsTextEntry = types
  .model('TagTextEntryThroughModelRelationshipsTextEntry ', {
    data: TagTextEntryThroughModelJsonApiRelationshipsTextEntryData,
  })
  .actions(() => ({}));

const TagTextEntryThroughModelRelationships = types
  .model('TextEntryRelationships', {
    tag: TagTextEntryThroughModelRelationshipsTag,
    text_entry: TagTextEntryThroughModelRelationshipsTextEntry,
  })
  .actions(() => ({}));

export const TagTextEntryThroughModel = types
  .model('TagTextEntryThroughModelJsonAPI', {
    id: types.identifier,
    type: types.string,
    attributes: TagTextEntryThroughModelAttributes,
    relationships: TagTextEntryThroughModelRelationships,
  })
  .actions(self => ({
    update(object: ITagTextEntryThroughModelJsonApi) {
      Object.assign(self, object);
    },
    remove() {
      getParent<RootModel>(self, 2).removeTagTextEntryThroughModel(self.id);
    },
  }));
