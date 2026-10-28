/**
 * The lists' sorting and searching, done on the user's data in IndexedDB.
 * Sort orders are the menus' keys: a field, or `-field` descending.
 */
import {parseDateTime} from '@commandsnippets/api-shared/datetime';
import type {
  Tag,
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';

type Key = string | number;

const compare = (x: Key, y: Key) => (x < y ? -1 : x > y ? 1 : 0);

/**
 * `items` by `key`, ascending, or descending for `-`, then by `tie`
 * (ascending) where they tie, as a new array. Each item's keys are worked
 * out once, not in every comparison: a date key parses its date, and a list
 * is sorted again on every keystroke of a search.
 */
function sortBy<T>(
  items: readonly T[],
  order: string,
  key: (item: T) => Key,
  tie?: (item: T) => Key
): T[] {
  const direction = order.startsWith('-') ? -1 : 1;
  return items
    .map(item => ({item, key: key(item), tie: tie?.(item) ?? 0}))
    .sort((a, b) => direction * compare(a.key, b.key) || compare(a.tie, b.tie))
    .map(({item}) => item);
}

/**
 * A date in the fixed-width UTC form, which compares chronologically as a
 * string to the microsecond (never, null: before every date).
 */
const time = (value: string | null) =>
  value === null ? '' : (parseDateTime(value) ?? value);

const TAG_KEYS: Record<string, (tag: Tag) => Key> = {
  name: tag => tag.attributes.name.toUpperCase(),
  date_created: tag => time(tag.attributes.date_created),
  date_updated: tag => time(tag.attributes.date_updated),
  date_last_used: tag => time(tag.attributes.date_last_used),
  entry_count: tag => tag.attributes.entry_count,
  order: tag => tag.attributes.order,
};

const subject = (entry: TextEntry) => entry.attributes.subject.toUpperCase();

const ENTRY_KEYS: Record<string, (entry: TextEntry) => Key> = {
  subject,
  body: entry => entry.attributes.body.toUpperCase(),
  date_created: entry => time(entry.attributes.date_created),
  date_updated: entry => time(entry.attributes.date_updated),
  tag_count: entry => entry.attributes.tag_count,
};

const field = (order: string) => order.replace(/^-/, '');

/**
 * A search that matches as the API's does (backend-v2's `lib/search.ts`):
 * case-insensitively, in any script.
 */
export const fold = (text: string) => text.toUpperCase();

/** The tags not deleted whose names hold `search`, in `order`. */
export function sortTags(
  tags: readonly Tag[],
  order: string,
  search: string
): Tag[] {
  const key = TAG_KEYS[field(order)] ?? ((tag: Tag) => tag.attributes.order);
  const term = fold(search);
  return sortBy(
    tags.filter(
      tag =>
        !tag.attributes.is_deleted &&
        (term === '' || fold(tag.attributes.name).includes(term))
    ),
    order,
    key
  );
}

/** Whether `entry`'s subject or body holds `term`, already folded. */
const holds = (entry: TextEntry, term: string) =>
  fold(entry.attributes.subject).includes(term) ||
  fold(entry.attributes.body).includes(term);

/** Whether `entry`'s subject or body holds `search`. */
export function entryMatches(entry: TextEntry, search: string): boolean {
  return holds(entry, fold(search));
}

/** The `items` whose entries hold `search`: all of them for no search. */
function matching<T>(
  items: readonly T[],
  entryOf: (item: T) => TextEntry,
  search: string
): readonly T[] {
  if (search === '') {
    return items;
  }
  const term = fold(search);
  return items.filter(item => holds(entryOf(item), term));
}

const itself = (entry: TextEntry) => entry;

/**
 * `entries` that match `search`, in `order` (one of the entry fields), and
 * by subject where they tie (many share a tag count).
 */
export function sortEntries(
  entries: readonly TextEntry[],
  order: string,
  search: string
): TextEntry[] {
  const key =
    ENTRY_KEYS[field(order)] ??
    ((entry: TextEntry) => time(entry.attributes.date_updated));
  return sortBy(matching(entries, itself, search), order, key, subject);
}

/** A tag's entry, with the junction that puts it there. */
export interface TaggedEntry {
  entry: TextEntry;
  junction: TagTextEntry;
}

const entryOf = ({entry}: TaggedEntry) => entry;

/**
 * A tag's entries that match `search`, in `order`: the user's (`order`),
 * when each was tagged (`date_tagged`), or one of the entry fields.
 */
export function sortTagEntries(
  tagged: readonly TaggedEntry[],
  order: string,
  search: string
): TextEntry[] {
  const shown = matching(tagged, entryOf, search);
  if (field(order) === 'order' || field(order) === 'date_tagged') {
    const key =
      field(order) === 'order'
        ? ({junction}: TaggedEntry) => junction.attributes.order
        : ({junction}: TaggedEntry) => time(junction.attributes.date_created);
    return sortBy(shown, order, key).map(entryOf);
  }
  return sortEntries(shown.map(entryOf), order, '');
}
