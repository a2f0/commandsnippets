import {ITagJsonApiResponseSingle} from '../../../src/lib/tags';

const textEntryPostResponse: ITagJsonApiResponseSingle = {
  data: {
    type: 'Tag',
    id: '3',
    attributes: {
      name: 'tag-3',
      date_updated: '2022-01-14T07:26:20.559650',
      date_created: '2022-01-14T07:26:20.559640',
      date_last_used: '2022-01-14T07:26:20.559640',
      is_deleted: false,
      entry_count: 0,
      order: 3,
    },
    relationships: {
      user: {
        data: {
          type: 'User',
          id: '1',
        },
      },
    },
  },
  included: [
    {
      type: 'User',
      id: '1',
      attributes: {
        username: 'test',
        date_updated: '2020-04-13T18:20:00',
      },
    },
  ],
};

export default textEntryPostResponse;
