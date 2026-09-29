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

/** Compare `a` and `b` by `key`, ascending, or descending for `-`. */
function by<T>(order: string, key: (item: T) => Key) {
  const direction = order.startsWith('-') ? -1 : 1;
  return (a: T, b: T) => {
    const [x, y] = [key(a), key(b)];
    return direction * (x < y ? -1 : x > y ? 1 : 0);
  };
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

const ENTRY_KEYS: Record<string, (entry: TextEntry) => Key> = {
  subject: entry => entry.attributes.subject.toUpperCase(),
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
  return tags
    .filter(
      tag =>
        !tag.attributes.is_deleted && fold(tag.attributes.name).includes(term)
    )
    .sort(by(order, key));
}

/** Whether `entry`'s subject or body holds `search`. */
export function entryMatches(entry: TextEntry, search: string): boolean {
  const term = fold(search);
  return (
    fold(entry.attributes.subject).includes(term) ||
    fold(entry.attributes.body).includes(term)
  );
}

/** `entries` that match `search`, in `order` (one of the entry fields). */
export function sortEntries(
  entries: readonly TextEntry[],
  order: string,
  search: string
): TextEntry[] {
  const key =
    ENTRY_KEYS[field(order)] ??
    ((entry: TextEntry) => time(entry.attributes.date_updated));
  return entries
    .filter(entry => entryMatches(entry, search))
    .sort(by(order, key));
}

/** A tag's entry, with the junction that puts it there. */
export interface TaggedEntry {
  entry: TextEntry;
  junction: TagTextEntry;
}

/**
 * A tag's entries that match `search`, in `order`: the user's (`order`),
 * when each was tagged (`date_tagged`), or one of the entry fields.
 */
export function sortTagEntries(
  tagged: readonly TaggedEntry[],
  order: string,
  search: string
): TextEntry[] {
  const matching = tagged.filter(({entry}) => entryMatches(entry, search));
  if (field(order) === 'order' || field(order) === 'date_tagged') {
    const key =
      field(order) === 'order'
        ? ({junction}: TaggedEntry) => junction.attributes.order
        : ({junction}: TaggedEntry) => time(junction.attributes.date_created);
    return matching.sort(by(order, key)).map(({entry}) => entry);
  }
  return sortEntries(
    matching.map(({entry}) => entry),
    order,
    ''
  );
}
