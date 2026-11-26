import type {EntryKind} from '@commandsnippets/api-shared/responses';
import {countTagEntries} from '../../../../src/lib/data/tagEntryCounts';
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
