import type {EntryKind} from '@commandsnippets/api-shared/responses';

/**
 * An entry, as far as its kind goes: a row stored before entries had kinds
 * has none.
 */
interface Kinded {
  attributes: {kind?: EntryKind | undefined};
}

/**
 * Whether the entry is a shortcut (keys to press): drawn as keys, and with
 * nothing to copy, so it has no Copy and a click only selects it.
 */
export const isShortcut = (entry: Kinded): boolean =>
  entry.attributes.kind === 'shortcut';

/**
 * Which entries the lists show and the tags count (View > All Entry Types,
 * Keyboard Shortcuts or Text Entries): every one, or those of one kind.
 */
export type EntryKindFilter = 'all' | EntryKind;

const FILTERS: readonly EntryKindFilter[] = ['all', 'shortcut', 'snippet'];

/** `value` as a filter: one saved that is none (any longer) shows all. */
export const entryKindFilterOf = (value: unknown): EntryKindFilter =>
  FILTERS.find(filter => filter === value) ?? 'all';

/** The entry's kind; a row stored before entries had kinds is a snippet. */
export const kindOf = (entry: Kinded): EntryKind =>
  isShortcut(entry) ? 'shortcut' : 'snippet';

/** Whether `filter` shows `entry`. */
export const shownByKind = (entry: Kinded, filter: EntryKindFilter): boolean =>
  filter === 'all' || kindOf(entry) === filter;
