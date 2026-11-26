import type {Tag} from '@commandsnippets/api-shared/responses';
import React, {useEffect} from 'react';
import {useTagListing} from '../../lib/data/tagListing';
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
 * The tag list (`useTagListing`). With no tag or entries list in the URL,
 * it opens the first, once the tags are listed with their counts (not
 * from a list kept while they are read). Each render is timed for the HUD.
 */
const TagListWrapper = () => {
  const renderStart = performance.now();
  const user = useRouteParam('user');
  const tag = useRouteParam('tag');
  const entriesList = useSearchParam('entries');
  const setTagSelectedID = useAppState(state => state.setTagSelectedID);
  const listing = useTagListing();
  const tags = listing.status === 'unread' ? undefined : listing.tags;

  const first = listing.status === 'listed' ? listing.tags[0] : undefined;
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
      entryCounts={listing.status === 'unread' ? null : listing.entryCounts}
    />
  );
};

const memoizedTagListWrapper = React.memo(TagListWrapper);

export {memoizedTagListWrapper as TagListWrapper};
