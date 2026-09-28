import {
  type SortKey,
  TEXT_ENTRY_SORT_FIELDS,
  type TextEntrySortField,
} from '@commandsnippets/api-shared/requests';

/** The order the entries list starts in (`defaultState.entrySortOrder`). */
const DEFAULT_SORT = 'date_updated';

function isEntrySortKey(order: string): order is SortKey<TextEntrySortField> {
  const field = order.startsWith('-') ? order.slice(1) : order;
  return TEXT_ENTRY_SORT_FIELDS.some(sortField => sortField === field);
}

/**
 * The entries list's sort order (`entrySortOrder`) as the API's `sort`. The
 * store keeps a string; the Entries menu only ever sets one of the API's sort
 * keys (`subject`, `-body`, ...), but a snapshot saved by an older version
 * could hold anything, which the API would refuse: that sorts by the default.
 */
export function entrySortKey(order: string): SortKey<TextEntrySortField> {
  return isEntrySortKey(order) ? order : DEFAULT_SORT;
}
