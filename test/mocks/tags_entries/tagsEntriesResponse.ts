const tagsEntriesResponse = {
  links: {
    first: 'http://localhost:9001/api/v1/tags_entries?page%5Bnumber%5D=1',
    last: 'http://localhost:9001/api/v1/tags_entries?page%5Bnumber%5D=1',
    next: null,
    prev: null,
  },
  data: [
    {
      type: 'TagTextEntryThroughModel',
      id: '1',
      attributes: {},
      relationships: {
        tag: {
          data: {
            type: 'Tag',
            id: '1',
          },
        },
        user: {
          data: {
            type: 'User',
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
  ],
  included: [
    {
      type: 'Tag',
      id: '1',
      attributes: {
        name: 'test',
        date_created: '2020-03-26T18:20:00',
        date_updated: '2020-03-26T18:20:00',
        entry_count: 27,
        order: 1,
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
      id: '1',
      attributes: {
        body: 'nvm use v8.16.0\n',
        subject: 'use a specific version of nvm',
        date_updated: '2019-08-20T18:21:00',
        date_created: '2019-08-20T18:21:00',
        reused_count: 0,
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
      type: 'User',
      id: '1',
      attributes: {
        username: 'test',
        date_updated: '2020-04-13T18:20:00',
      },
    },
  ],
  meta: {
    pagination: {
      page: 1,
      pages: 1,
      count: 1,
    },
  },
};

export default tagsEntriesResponse;
