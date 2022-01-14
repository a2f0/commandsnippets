import {ITagTextEntryThroughModelJsonApiResponseSingle} from '../../../src/lib/tag_text_entry_through_models';

const tagTextEntryThroughModelsResponse: ITagTextEntryThroughModelJsonApiResponseSingle =
  {
    data: {
      type: 'TagTextEntryThroughModel',
      id: '3',
      attributes: {
        order: 3,
        date_updated: '2022-01-14T10:10:31.684433',
        date_created: '2022-01-14T10:10:31.684418',
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
            id: '3',
          },
        },
      },
    },
  };

export default tagTextEntryThroughModelsResponse;
