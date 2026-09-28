import {describe, expect, it} from 'vitest';

import {filterAndSort} from '../../../src/lib/tags';
import {createStore, tag} from '../../util/storeFixtures';

describe('filterAndSort', () => {
  // Created in one order and updated in another.
  const tags = [
    tag('1', {
      name: 'created-last',
      date_created: '2021-01-01T00:00:00',
      date_updated: '2019-01-01T00:00:00',
    }),
    tag('2', {
      name: 'created-first',
      date_created: '2019-01-01T00:00:00',
      date_updated: '2021-01-01T00:00:00',
    }),
    tag('3', {
      name: 'created-second',
      date_created: '2020-01-01T00:00:00',
      date_updated: '2020-06-01T00:00:00',
    }),
  ];

  it.each([
    ['date_created', ['created-first', 'created-second', 'created-last']],
    ['-date_created', ['created-last', 'created-second', 'created-first']],
    ['date_updated', ['created-last', 'created-second', 'created-first']],
    ['-date_updated', ['created-first', 'created-second', 'created-last']],
  ])('sorts by %s', (sortOrder, expected) => {
    const store = createStore(tags);
    store.setTagSortOrder(sortOrder);

    expect(filterAndSort(store).map(t => t.attributes.name)).toEqual(expected);
  });
});
