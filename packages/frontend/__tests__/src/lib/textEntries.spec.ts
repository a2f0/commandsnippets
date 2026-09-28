import {describe, expect, it} from 'vitest';

import type {ITextEntryJsonApi} from '../../../src/lib/api/responses/types';
import {sort} from '../../../src/lib/textEntries';
import {createStore, entry, testUser} from '../../util/storeFixtures';

const username = testUser.attributes.username;

function subjects(entries: ITextEntryJsonApi[]) {
  return entries.map(e => e.attributes.subject);
}

describe('sort', () => {
  describe('by date', () => {
    // Created in one order and updated in another.
    const entries = [
      entry('1', {
        subject: 'created-last',
        date_created: '2021-01-01T00:00:00',
        date_updated: '2019-01-01T00:00:00',
      }),
      entry('2', {
        subject: 'created-first',
        date_created: '2019-01-01T00:00:00',
        date_updated: '2021-01-01T00:00:00',
      }),
      entry('3', {
        subject: 'created-second',
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
      const sorted = sort(username, null, entries, sortOrder, createStore());

      expect(subjects(sorted)).toEqual(expected);
    });
  });

  describe('by text', () => {
    // Case-insensitive; the subjects and bodies sort in different orders.
    const entries = [
      entry('1', {subject: 'bravo', body: 'Charlie'}),
      entry('2', {subject: 'Charlie', body: 'alpha'}),
      entry('3', {subject: 'alpha', body: 'bravo'}),
    ];

    it.each([
      ['subject', ['3', '1', '2']],
      ['-subject', ['2', '1', '3']],
      ['body', ['2', '3', '1']],
      ['-body', ['1', '3', '2']],
    ])('sorts by %s', (sortOrder, expected) => {
      const sorted = sort(username, null, entries, sortOrder, createStore());

      expect(sorted.map(e => e.id)).toEqual(expected);
    });
  });
});
