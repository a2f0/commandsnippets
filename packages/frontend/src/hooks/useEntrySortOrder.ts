import {useSearchParams} from 'react-router-dom';

import {useAppContext} from '../AppContext';

/**
 * The sort order of the entries list on screen, for the Entries menu to set
 * and check. EntryList sorts a tag's list by
 * `tagTextEntryThroughModelSortOrder`, and the untagged and all-entries lists
 * (`?entries=untagged`, `?entries=all`) by `entrySortOrder`.
 */
export function useEntrySortOrder() {
  const appConfig = useAppContext();
  const [searchParams] = useSearchParams();
  const entriesFilter = searchParams.get('entries');
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
