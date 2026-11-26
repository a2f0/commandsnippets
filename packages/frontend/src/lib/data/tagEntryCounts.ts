import type {
  EntryKind,
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';
import {useLiveQuery} from 'dexie-react-hooks';
import {kindOf} from '../entryKind';
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

/**
 * Each tag's count of entries of `kind`, by tag id, from IndexedDB as syncs
 * and writes store them (the first load's, page by page): one query for the
 * whole tag list. Null for every kind, which reads nothing: the tags' own
 * `entry_count` counts them. Undefined until read.
 */
export function useTagEntryCounts(
  kind: EntryKind | null
): ReadonlyMap<string, number> | null | undefined {
  const session = useSession();
  return useLiveQuery(
    async () =>
      session === null || kind === null
        ? null
        : await timed(
            'idb',
            'useTagEntryCounts',
            () => tagEntryCounts(session, kind),
            counted
          ),
    [session, kind]
  );
}
