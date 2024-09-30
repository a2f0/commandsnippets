import {JsonObject} from '@wdio/types';

import {ITagJsonApiResponseSingle} from '../../../src/lib/tags';

const tagsDeleteResponse: ITagJsonApiResponseSingle & JsonObject = {
  data: {
    type: 'Tag',
    id: '1',
    attributes: {
      name: 'test-tag-1',
      date_created: '2020-05-07T18:20:00',
      date_updated: '2020-05-07T18:20:00',
      date_last_used: '2020-05-07T18:20:00',
      entry_count: 2,
      order: 1,
      is_deleted: true,
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
        username: 'a2f0',
        date_updated: '2021-11-03T15:39:52.624593',
      },
    },
  ],
};

export default tagsDeleteResponse;
