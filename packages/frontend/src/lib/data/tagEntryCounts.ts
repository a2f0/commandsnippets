import type {
  EntryKind,
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';
import {useLiveQuery} from 'dexie-react-hooks';
import {useLayoutEffect, useMemo, useRef} from 'react';
import {type EntryKindFilter, kindOf} from '../entryKind';
import {timed} from '../metrics/timings';
import {useSession} from './hooks';
import type {OwnedData} from './queries';

/**
 * How many entries of `kind` each tag holds, by tag id: its junctions not
 * deleted whose entries are live and of that kind, as the API counts a
 * tag's `entry_count` of every kind. A tag with none is not in the map.
 */
export function countTagEntries(
  junctions: readonly TagTextEntry[],
  entries: readonly TextEntry[],
  kind: EntryKind
): Map<string, number> {
  const ofKind = new Set(
    entries
      .filter(entry => !entry.attributes.is_deleted && kindOf(entry) === kind)
      .map(entry => entry.id)
  );
  const counts = new Map<string, number>();
  for (const {attributes, relationships} of junctions) {
    if (
      !attributes.is_deleted &&
      ofKind.has(relationships.text_entry.data.id)
    ) {
      const tagId = relationships.tag.data.id;
      counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * One kind's counts, by tag id, with the kind they count and the session
 * (whose data: null when signed out) they were read in.
 */
interface KindCounts {
  kind: EntryKind;
  session: object | null;
  counts: ReadonlyMap<string, number>;
}

/**
 * The counts the tag list shows and sorts by: the tags' own `entry_count`
 * for every kind (`all`); for one kind, `reading` until the database
 * answers for that kind, then its counts (`read`).
 */
export type TagCounts =
  | {status: 'all'}
  | {status: 'reading'; kind: EntryKind}
  | {status: 'read'; kind: EntryKind; counts: ReadonlyMap<string, number>};

/**
 * The counts for `filter` in `session`, from the query's last answer: one
 * of another kind or session (a live query answers with its last result
 * until it reads the next) leaves the kind asked for still `reading`.
 */
export function tagCountsOf(
  filter: EntryKindFilter,
  session: object | null,
  read: KindCounts | null | undefined
): TagCounts {
  if (filter === 'all') {
    return {status: 'all'};
  }
  return read?.kind === filter && read.session === session
    ? {status: 'read', kind: filter, counts: read.counts}
    : {status: 'reading', kind: filter};
}

const sameMap = (
  a: ReadonlyMap<string, number>,
  b: ReadonlyMap<string, number>
) => a.size === b.size && [...a].every(([key, value]) => b.get(key) === value);

/** Whether `a` and `b` are the same counts, of the same kind. */
export function sameTagCounts(a: TagCounts, b: TagCounts): boolean {
  if (a.status === 'all' || b.status === 'all') {
    return a.status === b.status;
  }
  if (a.status !== b.status || a.kind !== b.kind) {
    return false;
  }
  return (
    a.status !== 'read' || b.status !== 'read' || sameMap(a.counts, b.counts)
  );
}

async function tagEntryCounts(
  {db, owner}: OwnedData,
  kind: EntryKind
): Promise<Map<string, number>> {
  const [junctions, entries] = await Promise.all([
    db.junctions.where('owner').equals(owner).toArray(),
    db.entries.where('owner').equals(owner).toArray(),
  ]);
  return countTagEntries(junctions, entries, kind);
}

const counted = (counts: ReadonlyMap<string, number>) => `${counts.size} tags`;

const NO_COUNTS: ReadonlyMap<string, number> = new Map();

/**
 * The tag list's counts for `filter` (`TagCounts`): for one kind, each
 * tag's count of its entries, from IndexedDB as syncs and writes store
 * them, in one query for the whole list; for every kind, none read. Counts
 * read again unchanged (any write reads them again) keep their object, so
 * the list does not sort or render again.
 */
export function useTagCounts(filter: EntryKindFilter): TagCounts {
  const session = useSession();
  const kind = filter === 'all' ? null : filter;
  const read = useLiveQuery(async (): Promise<KindCounts | null> => {
    if (kind === null) {
      return null;
    }
    // Signed out: no tags, so none to count.
    if (session === null) {
      return {kind, session, counts: NO_COUNTS};
    }
    const counts = await timed(
      'idb',
      'useTagCounts',
      () => tagEntryCounts(session, kind),
      counted
    );
    return {kind, session, counts};
  }, [session, kind]);
  const last = useRef<TagCounts>({status: 'all'});
  const counts = useMemo(() => {
    const next = tagCountsOf(filter, session, read);
    return sameTagCounts(last.current, next) ? last.current : next;
  }, [filter, session, read]);
  useLayoutEffect(() => {
    last.current = counts;
  }, [counts]);
  return counts;
}
