const tagsEntriesResponseEmpty = {
  links: {
    first:
      'http://localhost:9001/api/v1/entries?filter%5Bdate_updated.gt%5D=2020-12-05T17%3A42%3A18.544527&filter%5Btags.name%5D=zsh&filter%5Buser.username%5D=a2f0&include=text_entry_to_tag.tag%2Ctext_entry_to_tag.user%2Cuser&page%5Bnumber%5D=1&sort=date_updated',
    last: 'http://localhost:9001/api/v1/entries?filter%5Bdate_updated.gt%5D=2020-12-05T17%3A42%3A18.544527&filter%5Btags.name%5D=zsh&filter%5Buser.username%5D=a2f0&include=text_entry_to_tag.tag%2Ctext_entry_to_tag.user%2Cuser&page%5Bnumber%5D=1&sort=date_updated',
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

export default tagsEntriesResponseEmpty;
