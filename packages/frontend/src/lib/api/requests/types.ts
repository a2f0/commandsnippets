// The requests' types are api-shared's: documents (`TagCreateDocument`,
// `TextEntryUpdateDocument`, ...) and the collections' query parameters
// (`TagListParams`, `TextEntryListParams`, ...), derived from the schemas the
// API validates them with.
import type {
  SortKey,
  TextEntryListParams,
  TextEntrySortField,
} from '@commandsnippets/api-shared/requests';

/** `GET /api/v1/entries`'s query: `TextEntryListParams`, as `textEntries.ts` names it. */
export type EntriesQueryParams = TextEntryListParams;

export interface IEntryFetchPage {
  page: number;
  username: string;
  sort: SortKey<TextEntrySortField>;
  search?: string;
  signal: AbortSignal;
}
