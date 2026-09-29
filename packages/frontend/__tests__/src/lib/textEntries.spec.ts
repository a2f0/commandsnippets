import {describe, expect, it} from 'vitest';

import type {ITextEntryJsonApi} from '../../../src/lib/api/responses/types';
import {sort} from '../../../src/lib/textEntries';
import {
  createStore,
  entry,
  junction,
  tag,
  testUser,
} from '../../util/storeFixtures';

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

  describe('by date tagged', () => {
    // Tagged in one order; the junctions' revisions (which entry edits
    // advance) in another.
    const tagged = (id: string, created: string, updated: string) => ({
      ...junction(id, '5', id),
      attributes: {
        order: Number(id),
        date_created: created,
        date_updated: updated,
        is_deleted: false,
      },
    });
    const resources = [
      tag('5', {}),
      entry('1', {subject: 'tagged-last'}),
      entry('2', {subject: 'tagged-first'}),
      entry('3', {subject: 'tagged-second'}),
      tagged('1', '2021-01-01T00:00:00', '2019-01-01T00:00:00'),
      tagged('2', '2019-01-01T00:00:00', '2021-01-01T00:00:00'),
      tagged('3', '2020-01-01T00:00:00', '2020-06-01T00:00:00'),
    ];

    it.each([
      ['date_tagged', ['tagged-first', 'tagged-second', 'tagged-last']],
      ['-date_tagged', ['tagged-last', 'tagged-second', 'tagged-first']],
    ])('sorts by %s: when each was tagged', (sortOrder, expected) => {
      const store = createStore(resources);
      const sorted = sort(
        username,
        'tag-5',
        store.textEntriesArray,
        sortOrder,
        store
      );

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

  describe('with a search', () => {
    const entries = [
      entry('1', {subject: 'Deploy script', body: 'kubectl apply'}),
      entry('2', {subject: 'notes', body: 'git REBASE'}),
      entry('3', {subject: 'other', body: 'other'}),
    ];
    const tagged = [
      tag('1', {name: 'shell'}),
      ...entries,
      junction('1', '1', '1'),
      junction('2', '1', '2'),
      junction('3', '1', '3'),
    ];

    it.each([
      ['an untagged list', null],
      ['a tag list', 'shell'],
    ])('%s matches the subject or body in any case', (_list, tagName) => {
      const store = createStore(tagged);
      const found = (search: string) => {
        store.setEntrySearchString(search);
        const sorted = sort(username, tagName, entries, 'date_updated', store);
        return sorted.map(e => e.id);
      };

      expect(found('DEPLOY')).toEqual(['1']);
      expect(found('Rebase')).toEqual(['2']);
      expect(found('apply')).toEqual(['1']);
    });
  });
});

// The Debug menu's "Populate IndexedDB": every entry of the user's, with the
// tags, junctions and users included, copied into the Dexie database.
