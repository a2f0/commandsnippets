import type {Tag} from '@commandsnippets/api-shared/responses';
import {useLayoutEffect, useMemo, useRef} from 'react';
import {useAppState} from '../state/appState';
import {useSession, useTags} from './hooks';
import {sortTags} from './sort';
import {type TagCounts, useTagCounts} from './tagEntryCounts';

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
 * The tag list: `unread` until the tags and their counts are read;
 * `listed`, sorted and searched by them; or, while another kind's counts
 * are read, the session's list last listed `kept` as it was, rather than
 * sorted or counted by unknown counts (nor its first tag opened).
 */
export type TagListing =
  | {status: 'unread'}
  | ({status: 'listed'} & ListedTags)
  | ({status: 'kept'} & ListedTags);

/** What the tag list is made from. */
export interface TagListingInput {
  /** The tags, undefined until read. */
  tags: readonly Tag[] | undefined;
  counts: TagCounts;
  order: string;
  search: string;
  session: object | null;
}

/** The tag list `input` makes, after `last`. */
export function tagListingOf(
  {tags, counts, order, search, session}: TagListingInput,
  last: TagListing
): TagListing {
  if (tags !== undefined && counts.status !== 'reading') {
    const entryCounts = counts.status === 'read' ? counts.counts : null;
    const sorted = sortTags(
      tags,
      order,
      search,
      entryCounts === null
        ? undefined
        : (tag: Tag) => entryCounts.get(tag.id) ?? 0
    );
    return {status: 'listed', tags: sorted, entryCounts, session};
  }
  if (
    counts.status === 'reading' &&
    last.status !== 'unread' &&
    last.session === session
  ) {
    return last.status === 'kept' ? last : {...last, status: 'kept'};
  }
  return {status: 'unread'};
}

/**
 * The user's tag list (`tagListingOf`): their tags from IndexedDB, as syncs
 * and writes store them, sorted and searched, with their counts of the
 * kind of entries the lists show (View): the API's `entry_count` for every
 * kind, else counted here (`useTagCounts`).
 */
export function useTagListing(): TagListing {
  const session = useSession();
  const tags = useTags();
  const order = useAppState(state => state.tagSortOrder);
  const search = useAppState(state => state.tagSearchString);
  const kindFilter = useAppState(state => state.entryKindFilter);
  const counts = useTagCounts(kindFilter);
  const last = useRef<TagListing>({status: 'unread'});
  const listing = useMemo(
    () => tagListingOf({tags, counts, order, search, session}, last.current),
    [tags, counts, order, search, session]
  );
  useLayoutEffect(() => {
    last.current = listing;
  }, [listing]);
  return listing;
}
