/**
 * Storing what the syncs read: each resource replaces the database's copy
 * unless that copy is a newer revision (the app's own writes store theirs
 * as they happen, and a sync may read an older one). Revisions compare
 * within a table only: each table has its own sequence.
 */
import {parseDateTime} from '@commandsnippets/api-shared/datetime';
import type {
  IncludedResource,
  Tag,
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';
import type {Table} from 'dexie';
import type {CommandsnippetsDatabase} from '../db/database';

interface Revised {
  id: string;
  attributes: {date_updated: string};
}

/** A rendered revision in the fixed-width form, which compares as a string. */
const revisionOf = (resource: Revised) =>
  parseDateTime(resource.attributes.date_updated) ??
  resource.attributes.date_updated;

/** Of each id in `resources`, the newest copy. */
function newestById<R extends Revised>(resources: readonly R[]): R[] {
  const newest = new Map<string, R>();
  for (const resource of resources) {
    const other = newest.get(resource.id);
    if (other === undefined || revisionOf(resource) >= revisionOf(other)) {
      newest.set(resource.id, resource);
    }
  }
  return [...newest.values()];
}

/**
 * Store `resources` in `table`, except where it holds a newer revision.
 * Returns the ones stored.
 */
export async function putNewer<R extends Revised>(
  table: Table<R, string>,
  resources: readonly R[]
): Promise<R[]> {
  const candidates = newestById(resources);
  const stored = await table.bulkGet(candidates.map(({id}) => id));
  const newer = candidates.filter((resource, index) => {
    const held = stored[index];
    return held === undefined || revisionOf(resource) >= revisionOf(held);
  });
  await table.bulkPut(newer);
  return newer;
}

const isJunction = (resource: IncludedResource): resource is TagTextEntry =>
  resource.type === 'TagTextEntryThroughModel';
const isEntry = (resource: IncludedResource): resource is TextEntry =>
  resource.type === 'TextEntry';

/**
 * Store `entries` and the junctions read with them (`included`). An entry's
 * `text_entry_to_tag` lists all of its junctions not deleted, so where its
 * copy here is the one stored (no older than the database's), a junction of
 * the entry the database holds that the list leaves out is deleted.
 */
export async function putEntries(
  db: CommandsnippetsDatabase,
  entries: readonly TextEntry[],
  included: readonly IncludedResource[] = []
): Promise<void> {
  const stored = await putNewer(db.entries, entries);
  await putNewer(db.junctions, included.filter(isJunction));
  for (const entry of stored) {
    const listed = new Set(
      entry.relationships.text_entry_to_tag.data.map(({id}) => id)
    );
    const gone = (
      await db.junctions
        .where('relationships.text_entry.data.id')
        .equals(entry.id)
        .toArray()
    ).filter(
      junction => !junction.attributes.is_deleted && !listed.has(junction.id)
    );
    await db.junctions.bulkPut(
      gone.map(junction => ({
        ...junction,
        attributes: {...junction.attributes, is_deleted: true},
      }))
    );
  }
}

/** Store `tags`. */
export async function putTags(
  db: CommandsnippetsDatabase,
  tags: readonly Tag[]
): Promise<void> {
  await putNewer(db.tags, tags);
}

/**
 * Store a tag's junctions (deleted ones too) and the entries included with
 * them, with their junctions.
 */
export async function putJunctions(
  db: CommandsnippetsDatabase,
  junctions: readonly TagTextEntry[],
  included: readonly IncludedResource[] = []
): Promise<void> {
  await putNewer(db.junctions, junctions);
  await putEntries(db, included.filter(isEntry), included);
}
