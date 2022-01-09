const tagsResponseEmpty = {
  links: {
    first:
      'http://api.tearleads.com/api/v1/tags?filter%5Bdate_updated.gt%5D=2022-01-01T01%3A58%3A15.972409&filter%5Buser.username%5D=a2f0&page%5Bnumber%5D=1&sort=date_updated',
    last: 'http://api.tearleads.com/api/v1/tags?filter%5Bdate_updated.gt%5D=2022-01-01T01%3A58%3A15.972409&filter%5Buser.username%5D=a2f0&page%5Bnumber%5D=1&sort=date_updated',
    next: null,
    prev: null,
  },
  data: [],
  meta: {
    pagination: {
      page: 1,
      pages: 1,
      count: 0,
    },
  },
};

export default tagsResponseEmpty;
