import type {JsonObject} from '@wdio/types';

import type {ITagTextEntryThroughModelJsonApiResponseSingle} from '../../../src/lib/tag_text_entry_through_models';

const tagTextEntryThroughModelsResponse: ITagTextEntryThroughModelJsonApiResponseSingle &
  JsonObject = {
  data: {
    type: 'TagTextEntryThroughModel',
    id: '5',
    attributes: {
      order: 5,
      date_updated: '2022-01-15T10:10:31.684433',
      date_created: '2022-01-15T10:10:31.684418',
    },
    relationships: {
      tag: {
        data: {
          type: 'Tag',
          id: '1',
        },
      },
      text_entry: {
        data: {
          type: 'TextEntry',
          id: '5',
        },
      },
    },
  },
};

export default tagTextEntryThroughModelsResponse;
