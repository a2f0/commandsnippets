import {useSearchParam} from '../lib/router/navigation';
import {useAppConfig} from '../lib/state/appState';

/**
 * The sort order of the entries list on screen, for the Entries menu to set
 * and check. EntryList sorts a tag's list by
 * `tagTextEntryThroughModelSortOrder`, and the untagged and all-entries lists
 * (`?entries=untagged`, `?entries=all`) by `entrySortOrder`.
 */
export function useEntrySortOrder() {
  const appConfig = useAppConfig();
  const entriesFilter = useSearchParam('entries');
  const tagList = entriesFilter !== 'untagged' && entriesFilter !== 'all';

  return {
    /** Whether the list is a tag's (rather than untagged or all entries). */
    tagList,
    sortOrder: tagList
      ? appConfig.tagTextEntryThroughModelSortOrder
      : appConfig.entrySortOrder,
    setSortOrder: (order: string) => {
      if (tagList) {
        appConfig.setTagTextEntryThroughModelSortOrder(order);
      } else {
        appConfig.setEntrySortOrder(order);
      }
    },
  };
}
