const textEntriesResponse = {
  links: {
    first:
      'http://localhost:9001/api/v1/entries?include=text_entry_to_tag.tag%2Ctext_entry_to_tag.user%2Cuser&page%5Bnumber%5D=1&page%5Bsize%5D=1',
    last: 'http://localhost:9001/api/v1/entries?include=text_entry_to_tag.tag%2Ctext_entry_to_tag.user%2Cuser&page%5Bnumber%5D=1&page%5Bsize%5D=1',
    next: null,
    prev: null,
  },
  data: [
    {
      type: 'TextEntry',
      id: '1',
      attributes: {
        body: 'aws rds describe-pending-maintenance-actions',
        subject: 'show pendings aws maintenance actions',
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
        text_entry_to_tag: {
          meta: {
            count: 1,
          },
          data: [
            {
              type: 'TagTextEntryThroughModel',
              id: '11',
            },
          ],
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
        user_id: 1,
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

export default textEntriesResponse;
