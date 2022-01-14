import {ITextEntryJsonApiResponse} from '../../../src/lib/text_entries';
const entriesResponse: ITextEntryJsonApiResponse = {
  links: {
    next: null,
  },
  data: [
    {
      type: 'TextEntry',
      id: '1',
      attributes: {
        body: 'entry-1-body',
        subject: 'entry-1-subject',
        date_updated: '2019-03-17T18:20:00',
        date_created: '2019-03-17T18:20:00',
        reused_count: 0,
        is_deleted: false,
        tag_count: 1,
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
    {
      type: 'TextEntry',
      id: '2',
      attributes: {
        body: 'entry-2-body',
        subject: 'entry-2-subject',
        date_updated: '2021-03-17T18:20:00',
        date_created: '2021-03-17T18:20:00',
        reused_count: 0,
        is_deleted: false,
        tag_count: 1,
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
  ],
  included: [
    {
      type: 'Tag',
      id: '1',
      attributes: {
        name: 'test',
        date_created: '2020-04-15T18:20:00',
        date_last_used: '2020-04-15T18:20:00',
        date_updated: '2020-12-28T17:36:18.397537',
        entry_count: 15,
        order: 1,
        is_deleted: false,
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
    {
      type: 'TagTextEntryThroughModel',
      id: '1',
      attributes: {
        order: 1,
        date_updated: '2020-04-13T18:20:00',
        date_created: '2020-04-13T18:20:00',
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
            id: '1',
          },
        },
      },
    },
    {
      type: 'TagTextEntryThroughModel',
      id: '2',
      attributes: {
        order: 1,
        date_updated: '2020-04-13T18:20:00',
        date_created: '2020-04-13T18:20:00',
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
            id: '2',
          },
        },
      },
    },
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

export default entriesResponse;
