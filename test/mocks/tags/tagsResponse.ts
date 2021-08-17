const tagsResponse = {
  links: {
    first: 'http://localhost:9001/api/v1/tags?page%5Bnumber%5D=1&sort=name',
    last: 'http://localhost:9001/api/v1/tags?page%5Bnumber%5D=1&sort=name',
    next: null,
    prev: null,
  },
  data: [
    {
      type: 'Tag',
      id: '1',
      attributes: {
        name: 'tag-1',
        date_created: '2020-05-07T18:20:00',
        date_updated: '2020-05-07T18:20:00',
        date_last_used: '2020-05-07T18:20:00',
        entry_count: 2,
        order: 2,
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
      type: 'Tag',
      id: '2',
      attributes: {
        name: 'tag-2',
        date_created: '2020-12-04T00:48:52.314737',
        date_updated: '2020-12-04T00:48:52.314757',
        date_last_used: '2020-12-04T00:48:52.314757',
        entry_count: 1,
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
  ],
  included: [
    {
      type: 'User',
      id: '0',
      attributes: {
        username: 'test',
      },
    },
  ],
  meta: {
    pagination: {
      page: 1,
      pages: 1,
      count: 2,
    },
  },
};

export default tagsResponse;
