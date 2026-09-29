import {describe, expect, it} from 'vitest';

import {
  sortEntries,
  sortTagEntries,
  sortTags,
} from '../../../../src/lib/data/sort';
import {entry, junction, tag} from '../../../util/storeFixtures';

const names = (tags: Array<{attributes: {name: string}}>) =>
  tags.map(({attributes}) => attributes.name);
const subjects = (entries: Array<{attributes: {subject: string}}>) =>
  entries.map(({attributes}) => attributes.subject);

describe('sortTags', () => {
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
    ['order', ['created-last', 'created-first', 'created-second']],
  ])('sorts by %s', (order, expected) => {
    expect(names(sortTags(tags, order, ''))).toEqual(expected);
  });

  // The API sends null for a tag that was never used.
  const used = [
    tag('1', {name: 'used-last', date_last_used: '2021-01-01T00:00:00'}),
    tag('2', {name: 'never-used', date_last_used: null}),
    tag('3', {name: 'used-first', date_last_used: '2020-01-01T00:00:00'}),
  ];

  it.each([
    ['date_last_used', ['never-used', 'used-first', 'used-last']],
    ['-date_last_used', ['used-last', 'used-first', 'never-used']],
  ])('sorts by %s, never used first', (order, expected) => {
    expect(names(sortTags(used, order, ''))).toEqual(expected);
  });

  it('leaves out deleted tags, and those whose names miss the search', () => {
    const listed = sortTags(
      [
        tag('1', {name: 'Shell'}),
        tag('2', {name: 'shell-old', is_deleted: true}),
        tag('3', {name: 'git'}),
      ],
      'name',
      'SHE'
    );
    expect(names(listed)).toEqual(['Shell']);
  });
});

describe('sortEntries', () => {
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
  ])('sorts by %s', (order, expected) => {
    expect(subjects(sortEntries(entries, order, ''))).toEqual(expected);
  });

  it.each([
    ['subject', ['3', '1', '2']],
    ['-subject', ['2', '1', '3']],
    ['body', ['2', '3', '1']],
    ['-body', ['1', '3', '2']],
  ])('sorts by %s, whatever the case', (order, expected) => {
    const texts = [
      entry('1', {subject: 'bravo', body: 'Charlie'}),
      entry('2', {subject: 'Charlie', body: 'alpha'}),
      entry('3', {subject: 'alpha', body: 'bravo'}),
    ];
    expect(sortEntries(texts, order, '').map(({id}) => id)).toEqual(expected);
  });

  it('matches the subject or body in any case, in any script', () => {
    const texts = [
      entry('1', {subject: 'Deploy script', body: 'kubectl apply'}),
      entry('2', {subject: 'notes', body: 'git REBASE'}),
      entry('3', {subject: 'Über', body: 'other'}),
    ];
    const found = (search: string) =>
      sortEntries(texts, 'date_updated', search).map(({id}) => id);
    expect(found('DEPLOY')).toEqual(['1']);
    expect(found('Rebase')).toEqual(['2']);
    expect(found('apply')).toEqual(['1']);
    expect(found('über')).toEqual(['3']);
  });
});

describe('sortTagEntries', () => {
  // Tagged (and ranked) in one order; the junctions' revisions (which entry
  // edits advance) in another.
  const tagged = (
    id: string,
    order: number,
    created: string,
    updated: string
  ) => ({
    entry: entry(id, {subject: `entry-${id}`}),
    junction: {
      ...junction(id, '5', id),
      attributes: {
        order,
        date_created: created,
        date_updated: updated,
        is_deleted: false,
      },
    },
  });
  const rows = [
    tagged('1', 2, '2021-01-01T00:00:00', '2019-01-01T00:00:00'),
    tagged('2', 0, '2019-01-01T00:00:00', '2021-01-01T00:00:00'),
    tagged('3', 1, '2020-01-01T00:00:00', '2020-06-01T00:00:00'),
  ];

  it.each([
    ['order', ['entry-2', 'entry-3', 'entry-1']],
    ['date_tagged', ['entry-2', 'entry-3', 'entry-1']],
    ['-date_tagged', ['entry-1', 'entry-3', 'entry-2']],
    ['-subject', ['entry-3', 'entry-2', 'entry-1']],
  ])('sorts by %s', (order, expected) => {
    expect(subjects(sortTagEntries(rows, order, ''))).toEqual(expected);
  });

  it('searches the entries', () => {
    expect(subjects(sortTagEntries(rows, 'order', 'ENTRY-3'))).toEqual([
      'entry-3',
    ]);
  });
});
