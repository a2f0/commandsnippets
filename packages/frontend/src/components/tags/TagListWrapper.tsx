import React, {useEffect, useMemo} from 'react';
import {useTags} from '../../lib/data/hooks';
import {sortTags} from '../../lib/data/sort';
import {useRenderTiming} from '../../lib/metrics/hooks';
import {
  navigate,
  useRouteParam,
  useSearchParam,
} from '../../lib/router/navigation';
import {useAppState} from '../../lib/state/appState';
import {TagList} from './TagList';

/**
 * The user's tags (from IndexedDB, as syncs and writes store them), sorted
 * and searched. With no tag or entries list in the URL, it opens the first.
 * Each render is timed for the HUD.
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

  const tags = useMemo(
    () =>
      allTags === undefined
        ? undefined
        : sortTags(allTags, tagSortOrder, tagSearchString),
    [allTags, tagSortOrder, tagSearchString]
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
      navigate(`/${user}/${first.attributes.name}`);
    }
  }, [user, tag, entriesList, current, first, setTagSelectedID]);

  useRenderTiming('TagList', renderStart, `${tags?.length ?? 0} tags`);

  if (user === undefined) {
    return null;
  }

  return <TagList tagsFromWrapper={tags ?? []} username={user} />;
};

const memoizedTagListWrapper = React.memo(TagListWrapper);

export {memoizedTagListWrapper as TagListWrapper};
