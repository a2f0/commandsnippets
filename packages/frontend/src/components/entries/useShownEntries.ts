import type {TextEntry} from '@commandsnippets/api-shared';
import {useLayoutEffect, useMemo, useRef} from 'react';
import {
  useEntries,
  useEntryTagNames,
  useTagEntries,
  useTagNamed,
} from '../../lib/data/hooks';
import {keyOfRow} from '../../lib/data/rowKey';
import {sortEntries, sortTagEntries} from '../../lib/data/sort';
import {useTagSync} from '../../lib/data/useSync';
import {listKey, listShown} from '../../lib/metrics/timings';
import {useRouteParam, useSearchParam} from '../../lib/router/navigation';
import {useAppState} from '../../lib/state/appState';
import {keepUnchanged} from './unchangedRows';

/**
 * The entries the list shows: a tag's (`/:user/:tag`), or all or the
 * untagged ones (`?entries=all`, `?entries=untagged`), from IndexedDB as
 * syncs and writes store them, sorted and searched (undefined until read).
 * The tag shown syncs whenever it is not synced through its revision, and
 * the first render of the list asked for with its own rows ends the
 * interaction that asked for it (`listShown`).
 */
export function useShownEntries() {
  const tag = useRouteParam('tag');
  const entriesList = useSearchParam('entries');
  const listsAll = entriesList === 'all' || entriesList === 'untagged';

  const named = useTagNamed(listsAll ? undefined : tag);
  const currentTag = named?.tag;
  useTagSync(currentTag);
  const tagged = useTagEntries(currentTag?.id);
  // (Nothing to read for a tag's list.)
  const listed = useEntries(
    listsAll ? (entriesList === 'all' ? 'all' : 'untagged') : null
  );
  // The tag the rows are of, read with them: the last tag's while the next
  // tag's are read, and none in the all or untagged list.
  const tagId = listsAll ? undefined : tagged?.tagId;
  // The tags shown under each entry: all of its tags, but the one the rows
  // are of in a tag's list.
  const tagNames = useEntryTagNames(tagId);
  const tagOrder = useAppState(
    state => state.tagTextEntryThroughModelSortOrder
  );
  const entryOrder = useAppState(state => state.entrySortOrder);
  const search = useAppState(state => state.entrySearchString);
  // The rows last shown, by key: an entry that the next read (a write's,
  // which reads every row again) finds unchanged keeps its object, so only
  // the rows the write changed render again.
  const lastShown = useRef<ReadonlyMap<string, TextEntry>>(new Map());
  const shown = useMemo(() => {
    const sorted = listsAll
      ? listed && sortEntries(listed.entries, entryOrder, search)
      : tagged && sortTagEntries(tagged.entries, tagOrder, search);
    return sorted && keepUnchanged(sorted, lastShown.current, keyOfRow);
  }, [listsAll, listed, tagged, entryOrder, tagOrder, search]);
  useLayoutEffect(() => {
    lastShown.current = new Map(
      (shown ?? []).map(entry => [keyOfRow(entry), entry])
    );
  }, [shown]);
  // The list asked for, with its own rows: not the last list's, which the
  // queries answer with until they read the next.
  const shownList = listsAll
    ? listKey({entries: entriesList ?? ''})
    : listKey({tag: tag ?? ''});
  const ownRows = listsAll
    ? listed?.which === entriesList
    : named !== undefined &&
      named.name === tag &&
      tagged?.tagId === named.tag?.id;
  useLayoutEffect(() => {
    if (ownRows) {
      listShown(shownList);
    }
  }, [ownRows, shownList]);

  return {shown, currentTag, tagId, tagNames};
}
