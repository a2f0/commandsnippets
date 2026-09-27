import {getParent, types} from 'mobx-state-tree';

import type {RootModel} from './RootModel';

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

export const TagTextEntryThroughModel = types
  .model('TagTextEntryThroughModelJsonAPI', {
    id: types.identifier,
    type: types.string,
    attributes: types
      .model('TagTextEntryThroughModelAttributes', {
        order: types.number,
        date_updated: types.string,
        date_created: types.string,
      })
      .actions(() => ({})),
    relationships: types
      .model('TextEntryRelationships', {
        tag: types
          .model('TagTextEntryThroughModelRelationshipsTag ', {
            data: types
              .model('TagTextEntryThroughModelJsonApiRelationshipsTagData', {
                id: types.string,
                type: types.string,
              })
              .actions(() => ({})),
          })
          .actions(() => ({})),
        text_entry: types
          .model('TagTextEntryThroughModelRelationshipsTextEntry ', {
            data: types
              .model(
                'TagTextEntryThroughModelJsonApiRelationshipsTextEntryData',
                {
                  id: types.string,
                  type: types.string,
                }
              )
              .actions(() => ({})),
          })
          .actions(() => ({})),
      })
      .actions(() => ({})),
  })
  .actions(self => ({
    update(object: ITagTextEntryThroughModelJsonApi) {
      Object.assign(self, object);
    },
    remove() {
      getParent<typeof RootModel>(self, 2).removeTagTextEntryThroughModel(
        self.id
      );
    },
  }));
