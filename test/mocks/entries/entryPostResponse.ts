import {JsonObject} from '@wdio/types';

import {ITextEntryJsonApiResponseSingle} from '../../../src/lib/text_entries';

const textEntryPostResponse: ITextEntryJsonApiResponseSingle & JsonObject = {
  data: {
    type: 'TextEntry',
    id: '5',
    attributes: {
      body: 'Body Line 1\nBody Line 2',
      subject: 'Subject',
      date_updated: '2022-01-14T07:26:20.559650',
      date_created: '2022-01-14T07:26:20.559640',
      reused_count: 0,
      is_deleted: false,
      tag_count: 0,
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
  included: [],
};

export default textEntryPostResponse;
