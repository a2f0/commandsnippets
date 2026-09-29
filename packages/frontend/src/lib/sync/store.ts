/**
 * Storing what the syncs read: each resource replaces the database's copy
 * unless that copy is a newer revision (the app's own writes store theirs
 * as they happen, and a sync may read an older one). Revisions compare
 * within a table only: each table has its own sequence. Every resource
 * stored must be the database owner's (`checkOwner`).
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

/** A resource from another account than the database's, which is refused. */
export class ForeignDataError extends Error {
  constructor(type: string, id: string) {
    super(`${type} ${id} is not the signed-in user's: not stored`);
    this.name = 'ForeignDataError';
  }
}

/** Refuse `resources` unless every one is user `ownerId`'s. */
export function checkOwner(
  ownerId: string,
  resources: ReadonlyArray<IncludedResource | Tag | TextEntry | TagTextEntry>
): void {
  for (const resource of resources) {
    if (
      'relationships' in resource &&
      'user' in resource.relationships &&
      resource.relationships.user.data.id !== ownerId
    ) {
      throw new ForeignDataError(resource.type, resource.id);
    }
  }
}

/** A rendered revision in the fixed-width form, which compares as a string. */
const revisionOf = (resource: Revised) =>
  parseDateTime(resource.attributes.date_updated) ??
  resource.attributes.date_updated;

/**
 * Whether `incoming` replaces `held`: a newer revision, or the same one when
 * `tie` says so.
 */
function replaces<R extends Revised>(
  incoming: R,
  held: R,
  tie: (incoming: R, held: R) => boolean
): boolean {
  const [a, b] = [revisionOf(incoming), revisionOf(held)];
  return a > b || (a === b && tie(incoming, held));
}

/**
 * Store `resources` in `table`, except where it holds a newer revision (or
 * the same one, where `tie` keeps it). Returns the ones stored.
 */
export async function putNewer<R extends Revised>(
  table: Table<R, string>,
  resources: readonly R[],
  tie: (incoming: R, held: R) => boolean = () => true
): Promise<R[]> {
  const newest = new Map<string, R>();
  for (const resource of resources) {
    const other = newest.get(resource.id);
    if (other === undefined || replaces(resource, other, tie)) {
      newest.set(resource.id, resource);
    }
  }
  const candidates = [...newest.values()];
  const stored = await table.bulkGet(candidates.map(({id}) => id));
  const newer = candidates.filter((resource, index) => {
    const held = stored[index];
    return held === undefined || replaces(resource, held, tie);
  });
  await table.bulkPut(newer);
  return newer;
}

/**
 * At the same revision, a deleted copy stays. A deletion this database
 * stored without the API's revision (worked out from an entry's listing, or
 * a delete the API answered with no body) keeps the last one, and an active
 * copy of that revision is older news: restoring gives a new revision.
 */
const deletedStays = <R extends {attributes: {is_deleted: boolean}}>(
  incoming: R,
  held: R
) => incoming.attributes.is_deleted || !held.attributes.is_deleted;

const putJunctionsNewer = (
  db: CommandsnippetsDatabase,
  junctions: readonly TagTextEntry[]
) => putNewer(db.junctions, junctions, deletedStays);

const isJunction = (resource: IncludedResource): resource is TagTextEntry =>
  resource.type === 'TagTextEntryThroughModel';
const isEntry = (resource: IncludedResource): resource is TextEntry =>
  resource.type === 'TextEntry';

/**
 * Store `entries` and their junctions read with them (`included`). An
 * entry's `text_entry_to_tag` lists all of its junctions not deleted, so an
 * entry stored (its copy no older than the database's) decides its
 * junctions: the ones listed are stored, and those it leaves out are deleted.
 * An entry not stored (an older copy) leaves its junctions as they are.
 */
export async function putEntries(
  db: CommandsnippetsDatabase,
  entries: readonly TextEntry[],
  included: readonly IncludedResource[] = []
): Promise<void> {
  const stored = await putNewer(db.entries, entries, deletedStays);
  const storedIds = new Set(stored.map(({id}) => id));
  await putJunctionsNewer(
    db,
    included
      .filter(isJunction)
      .filter(junction =>
        storedIds.has(junction.relationships.text_entry.data.id)
      )
  );
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
 * Store a tag's junctions (deleted ones too, with the revisions the API gave
 * them) and the entries included with them, with their junctions.
 */
export async function putJunctions(
  db: CommandsnippetsDatabase,
  junctions: readonly TagTextEntry[],
  included: readonly IncludedResource[] = []
): Promise<void> {
  await putJunctionsNewer(db, junctions);
  await putEntries(db, included.filter(isEntry), included);
}

const isTag = (resource: IncludedResource): resource is Tag =>
  resource.type === 'Tag';

/**
 * Store a write's answer (its `data` and `included`): tags, entries with
 * their junctions, and junctions whose entries are not among them.
 */
export async function putResources(
  db: CommandsnippetsDatabase,
  resources: readonly IncludedResource[]
): Promise<void> {
  await db.transaction('rw', [db.tags, db.entries, db.junctions], async () => {
    await putTags(db, resources.filter(isTag));
    const entries = resources.filter(isEntry);
    const entryIds = new Set(entries.map(({id}) => id));
    const junctions = resources.filter(isJunction);
    await putJunctionsNewer(
      db,
      junctions.filter(
        junction => !entryIds.has(junction.relationships.text_entry.data.id)
      )
    );
    await putEntries(db, entries, junctions);
  });
}
