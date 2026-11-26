import type {EntryKind} from '@commandsnippets/api-shared/responses';
import {
  type EntryKindFilter,
  kindOf,
  shownByKind,
} from '../../../src/lib/entryKind';

/** An entry's attributes of `kind` (none: stored before entries had kinds). */
const of = (kind: EntryKind | undefined) => ({attributes: {kind}});

describe('entry kinds', () => {
  it.each<[EntryKind | undefined, EntryKind]>([
    ['shortcut', 'shortcut'],
    ['snippet', 'snippet'],
    [undefined, 'snippet'],
  ])('reads %s as a %s', (kind, expected) => {
    expect(kindOf(of(kind))).toBe(expected);
  });

  it.each<[EntryKindFilter, EntryKind | undefined, boolean]>([
    ['all', 'shortcut', true],
    ['all', 'snippet', true],
    ['shortcut', 'shortcut', true],
    ['shortcut', 'snippet', false],
    ['shortcut', undefined, false],
    ['snippet', 'shortcut', false],
    ['snippet', 'snippet', true],
    ['snippet', undefined, true],
  ])('%s shows a %s: %s', (filter, kind, shown) => {
    expect(shownByKind(of(kind), filter)).toBe(shown);
  });
});
