import type {Tag} from '@commandsnippets/api-shared/responses';
import React, {useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import {useSession, useTags} from '../../lib/data/hooks';
import {sortTags} from '../../lib/data/sort';
import {useTagCounts} from '../../lib/data/tagEntryCounts';
import {useRenderTiming} from '../../lib/metrics/hooks';
import {
  navigate,
  useRouteParam,
  useSearchParam,
} from '../../lib/router/navigation';
import {tagPath} from '../../lib/router/route';
import {useAppState} from '../../lib/state/appState';
import {TagList} from './TagList';

// The list before the tags are read: the same one each render, so the
// list (memoized) does not render again until they are.
const NO_TAGS: Tag[] = [];

/**
 * The tags as listed, with the counts they show (null: their own), and the
 * session (whose data) they were read in.
 */
interface ListedTags {
  tags: Tag[];
  entryCounts: ReadonlyMap<string, number> | null;
  session: object | null;
}

/**
 * The user's tags (from IndexedDB, as syncs and writes store them), sorted
 * and searched, with their counts of the kind of entries the lists show
 * (View): the API's `entry_count` for every kind, else counted here
 * (`useTagCounts`). `listed` is undefined until the tags and those counts
 * are read; `shown` keeps the session's list last listed while another
 * kind's counts are read, rather than sorting or counting by unknown
 * counts.
 */
function useListedTags(): {
  listed: ListedTags | undefined;
  shown: ListedTags | undefined;
} {
  const session = useSession();
  const allTags = useTags();
  const tagSortOrder = useAppState(state => state.tagSortOrder);
  const tagSearchString = useAppState(state => state.tagSearchString);
  const kindFilter = useAppState(state => state.entryKindFilter);
  const counts = useTagCounts(kindFilter);

  const listed = useMemo((): ListedTags | undefined => {
    if (allTags === undefined || counts.status === 'reading') {
      return undefined;
    }
    const entryCounts = counts.status === 'read' ? counts.counts : null;
    const tags = sortTags(
      allTags,
      tagSortOrder,
      tagSearchString,
      entryCounts === null
        ? undefined
        : (counted: Tag) => entryCounts.get(counted.id) ?? 0
    );
    return {tags, entryCounts, session};
  }, [allTags, tagSortOrder, tagSearchString, counts, session]);

  const lastListed = useRef<ListedTags | undefined>(undefined);
  useLayoutEffect(() => {
    if (listed !== undefined) {
      lastListed.current = listed;
    }
  }, [listed]);
  const kept = lastListed.current;
  const shown =
    listed ??
    (counts.status === 'reading' && kept?.session === session
      ? kept
      : undefined);
  return {listed, shown};
}

/**
 * The tag list (`useListedTags`). With no tag or entries list in the URL,
 * it opens the first, once the tags are listed with their counts. Each
 * render is timed for the HUD.
 */
const TagListWrapper = () => {
  const renderStart = performance.now();
  const user = useRouteParam('user');
  const tag = useRouteParam('tag');
  const entriesList = useSearchParam('entries');
  const setTagSelectedID = useAppState(state => state.setTagSelectedID);
  const {listed, shown} = useListedTags();
  const tags = shown?.tags;

  // Of the tags listed: not a list kept while counts are read.
  const first = listed?.tags[0];
  const current = tags?.find(candidate => candidate.attributes.name === tag);
  useEffect(() => {
    if (user === undefined) {
      return;
    }
    if (current !== undefined) {
      setTagSelectedID(current.id);
    } else if (
      tag === undefined &&
      entriesList === null &&
      first !== undefined
    ) {
      setTagSelectedID(first.id);
      navigate(tagPath(user, first.attributes.name));
    }
  }, [user, tag, entriesList, current, first, setTagSelectedID]);

  useRenderTiming('TagList', renderStart, `${tags?.length ?? 0} tags`);

  if (user === undefined) {
    return null;
  }

  return (
    <TagList
      tagsFromWrapper={tags ?? NO_TAGS}
      username={user}
      entryCounts={shown?.entryCounts ?? null}
    />
  );
};

const memoizedTagListWrapper = React.memo(TagListWrapper);

export {memoizedTagListWrapper as TagListWrapper};
