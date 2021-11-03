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
        name: 'test',
        date_created: '2020-05-07T18:20:00',
        date_updated: '2020-05-07T18:20:00',
        date_last_used: '2020-05-07T18:20:00',
        entry_count: 2,
        order: 2,
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
  ],
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
  meta: {
    pagination: {
      page: 1,
      pages: 1,
      count: 1,
    },
  },
};

export default tagsResponse;
