import type {Tag} from '@commandsnippets/api-shared/responses';
import React, {useEffect, useMemo} from 'react';
import {useTags} from '../../lib/data/hooks';
import {sortTags} from '../../lib/data/sort';
import {useTagEntryCounts} from '../../lib/data/tagEntryCounts';
import {useRenderTiming} from '../../lib/metrics/hooks';
import {
  navigate,
  useRouteParam,
  useSearchParam,
} from '../../lib/router/navigation';
import {tagPath} from '../../lib/router/route';
import {useAppState} from '../../lib/state/appState';
import {TagList} from './TagList';

const NO_COUNTS: ReadonlyMap<string, number> = new Map();
// The list before the tags are read: the same one each render, so the
// list (memoized) does not render again until they are.
const NO_TAGS: Tag[] = [];

/**
 * The user's tags (from IndexedDB, as syncs and writes store them), sorted
 * and searched, with their counts of the kind of entries the lists show
 * (View): the API's `entry_count` for every kind, else counted here. With
 * no tag or entries list in the URL, it opens the first. Each render is
 * timed for the HUD.
 */
const TagListWrapper = () => {
  const renderStart = performance.now();
  const user = useRouteParam('user');
  const tag = useRouteParam('tag');
  const entriesList = useSearchParam('entries');
  const allTags = useTags();
  const tagSortOrder = useAppState(state => state.tagSortOrder);
  const tagSearchString = useAppState(state => state.tagSearchString);
  const setTagSelectedID = useAppState(state => state.setTagSelectedID);
  const kindFilter = useAppState(state => state.entryKindFilter);
  const kindCounts = useTagEntryCounts(
    kindFilter === 'all' ? null : kindFilter
  );
  // Until a kind's counts are read: none, rather than every kind's.
  const entryCounts = kindFilter === 'all' ? null : (kindCounts ?? NO_COUNTS);

  const tags = useMemo(
    () =>
      allTags === undefined
        ? undefined
        : sortTags(
            allTags,
            tagSortOrder,
            tagSearchString,
            entryCounts === null
              ? undefined
              : (tag: Tag) => entryCounts.get(tag.id) ?? 0
          ),
    [allTags, tagSortOrder, tagSearchString, entryCounts]
  );

  const first = tags?.[0];
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
      entryCounts={entryCounts}
    />
  );
};

const memoizedTagListWrapper = React.memo(TagListWrapper);

export {memoizedTagListWrapper as TagListWrapper};
