import type {EntryKind} from '@commandsnippets/api-shared/responses';
import {
  countTagEntries,
  sameTagCounts,
  type TagCounts,
  tagCountsOf,
} from '../../../../src/lib/data/tagEntryCounts';
import type {EntryKindFilter} from '../../../../src/lib/entryKind';
import {entry, junction} from '../../../util/storeFixtures';

describe('countTagEntries', () => {
  // Tag 1 holds a shortcut, a snippet, a deleted shortcut and a shortcut
  // untagged from it; tag 2 a shortcut.
  const shortcut = (id: string, deleted = false) =>
    entry(id, {kind: 'shortcut', is_deleted: deleted});
  const entries = [
    shortcut('1'),
    entry('2', {kind: 'snippet'}),
    shortcut('3', true),
    shortcut('4'),
    shortcut('5'),
  ];
  const junctions = [
    junction('10', '1', '1'),
    junction('11', '1', '2'),
    junction('12', '1', '3'),
    junction('13', '1', '4', {is_deleted: true}),
    junction('14', '2', '5'),
  ];

  it.each<[EntryKind, Record<string, number>]>([
    ['shortcut', {'1': 1, '2': 1}],
    ['snippet', {'1': 1}],
  ])('counts each tag’s live entries of kind %s', (kind, expected) => {
    expect(
      Object.fromEntries(countTagEntries(junctions, entries, kind))
    ).toEqual(expected);
  });

  it('leaves out a tag with none of the kind', () => {
    expect(
      countTagEntries([junction('11', '1', '2')], entries, 'shortcut').size
    ).toBe(0);
  });
});

describe('tagCountsOf', () => {
  const session = {};
  const other = {};
  const counts = new Map([['1', 2]]);
  const shortcuts = {kind: 'shortcut' as const, session, counts};

  it.each<
    [
      string,
      EntryKindFilter,
      object,
      typeof shortcuts | null | undefined,
      TagCounts,
    ]
  >([
    ['every kind', 'all', session, shortcuts, {status: 'all'}],
    [
      'a kind not read yet',
      'shortcut',
      session,
      undefined,
      {status: 'reading', kind: 'shortcut'},
    ],
    [
      'a kind read',
      'shortcut',
      session,
      shortcuts,
      {status: 'read', kind: 'shortcut', counts},
    ],
    [
      'a kind after another kind was read',
      'snippet',
      session,
      shortcuts,
      {status: 'reading', kind: 'snippet'},
    ],
    [
      'a kind read in another session',
      'shortcut',
      other,
      shortcuts,
      {status: 'reading', kind: 'shortcut'},
    ],
  ])('%s', (_case, filter, now, read, expected) => {
    expect(tagCountsOf(filter, now, read)).toEqual(expected);
  });
});

describe('sameTagCounts', () => {
  const read = (
    kind: 'shortcut' | 'snippet',
    entries: Array<[string, number]>
  ): TagCounts => ({
    status: 'read',
    kind,
    counts: new Map(entries),
  });

  it.each<[string, TagCounts, TagCounts, boolean]>([
    ['every kind', {status: 'all'}, {status: 'all'}, true],
    [
      'every kind and one',
      {status: 'all'},
      {status: 'reading', kind: 'shortcut'},
      false,
    ],
    [
      'one kind being read',
      {status: 'reading', kind: 'shortcut'},
      {status: 'reading', kind: 'shortcut'},
      true,
    ],
    [
      'two kinds being read',
      {status: 'reading', kind: 'shortcut'},
      {status: 'reading', kind: 'snippet'},
      false,
    ],
    [
      'read and being read',
      read('shortcut', []),
      {status: 'reading', kind: 'shortcut'},
      false,
    ],
    [
      'equal counts',
      read('shortcut', [
        ['1', 2],
        ['2', 1],
      ]),
      read('shortcut', [
        ['2', 1],
        ['1', 2],
      ]),
      true,
    ],
    [
      'a count changed',
      read('shortcut', [['1', 2]]),
      read('shortcut', [['1', 3]]),
      false,
    ],
    [
      'a tag more',
      read('shortcut', [['1', 2]]),
      read('shortcut', [
        ['1', 2],
        ['2', 1],
      ]),
      false,
    ],
    [
      'another kind',
      read('shortcut', [['1', 2]]),
      read('snippet', [['1', 2]]),
      false,
    ],
  ])('%s', (_case, a, b, same) => {
    expect(sameTagCounts(a, b)).toBe(same);
  });
});
