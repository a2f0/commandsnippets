/**
 * Storing what the API answers: a sync's pages, and the answers to queued
 * writes (`outbox.ts`). Each resource is stored under its owner (`owner`, a
 * username), and must be that user's (`checkOwner`).
 *
 * - A row with a write still queued is left as it is: the user's write
 *   stands until it reaches the API, whose answer then replaces it.
 * - Otherwise a sync's copy replaces the database's unless that copy is a
 *   newer revision (a sync may read an older one than a write's answer
 *   stored). Revisions compare within a table only: each table has its own
 *   sequence.
 * - A write's answer (`force`) replaces the database's copy whatever its
 *   revision: it is the row as the API holds it now, after the write (or as
 *   it stands, when a newer write won).
 */
import {parseDateTime} from '@commandsnippets/api-shared/datetime';
import type {
  IncludedResource,
  Tag,
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';
import type {Table} from 'dexie';
import {
  type CommandsnippetsDatabase,
  type RowKey,
  rowKey,
  type Stored,
} from '../db/database';

interface Revised {
  type: string;
  id: string;
  attributes: {date_updated: string};
}

/** A resource from another account than the one synced, which is refused. */
export class ForeignDataError extends Error {
  constructor(type: string, id: string) {
    super(`${type} ${id} is not the synced user's: not stored`);
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

/** The keys (`rowKey`) of `owner`'s `resources` that writes are queued for. */
export async function queuedFor(
  db: CommandsnippetsDatabase,
  owner: string,
  resources: ReadonlyArray<{type: string; id: string}>
): Promise<Set<string>> {
  if (resources.length === 0) {
    return new Set();
  }
  const keys = new Set(
    resources.map(resource => rowKey(owner, resource.type, resource.id))
  );
  const queued = await db.outbox
    .where('rows')
    .anyOf([...keys])
    .toArray();
  return new Set(
    queued.flatMap(write => write.rows).filter(key => keys.has(key))
  );
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

interface PutOptions<R> {
  /** At the same revision, whether the incoming copy replaces the held one. */
  tie?: (incoming: R, held: R) => boolean;
  /** A write's answer: replaces the held copy whatever its revision. */
  force?: boolean;
}

/**
 * Store `resources` in `table` under `owner`: none with a write queued, and
 * (unless `force`) none where the table holds a newer revision (or the same
 * one, where `tie` keeps it). Returns the ones stored.
 */
export async function putNewer<R extends Revised>(
  db: CommandsnippetsDatabase,
  table: Table<Stored<R>, RowKey>,
  owner: string,
  resources: readonly R[],
  {tie = () => true, force = false}: PutOptions<R> = {}
): Promise<R[]> {
  const newest = new Map<string, R>();
  for (const resource of resources) {
    const other = newest.get(resource.id);
    if (other === undefined || replaces(resource, other, tie)) {
      newest.set(resource.id, resource);
    }
  }
  const queued = await queuedFor(db, owner, [...newest.values()]);
  const candidates = [...newest.values()].filter(
    resource => !queued.has(rowKey(owner, resource.type, resource.id))
  );
  const stored = force
    ? []
    : await table.bulkGet(candidates.map(({id}): RowKey => [owner, id]));
  const newer = candidates.filter((resource, index) => {
    const held = stored[index];
    return force || held === undefined || replaces(resource, held, tie);
  });
  await table.bulkPut(newer.map(resource => ({...resource, owner})));
  return newer;
}

/**
 * At the same revision, a deleted copy stays. A deletion this database
 * stored without the API's revision (worked out from an entry's listing)
 * keeps the last one, and an active copy of that revision is older news:
 * restoring gives a new revision.
 */
const deletedStays = <R extends {attributes: {is_deleted: boolean}}>(
  incoming: R,
  held: R
) => incoming.attributes.is_deleted || !held.attributes.is_deleted;

const putJunctionsNewer = (
  db: CommandsnippetsDatabase,
  owner: string,
  junctions: readonly TagTextEntry[],
  force = false
) => putNewer(db, db.junctions, owner, junctions, {tie: deletedStays, force});

const isJunction = (resource: IncludedResource): resource is TagTextEntry =>
  resource.type === 'TagTextEntryThroughModel';
const isEntry = (resource: IncludedResource): resource is TextEntry =>
  resource.type === 'TextEntry';

/**
 * Store `entries` and their junctions read with them (`included`). The
 * junctions are stored on their own merits (each unless a write to it is
 * queued, or a newer revision is held), so an entry left as it is (one with
 * a write queued) still gets the taggings other devices made: the sync's
 * cursors move past them. An entry's `text_entry_to_tag` lists all of its
 * junctions not deleted, so an entry stored also decides its junctions:
 * those it leaves out are deleted (but for one a write is queued for: a
 * tagging not on the API yet). An entry not stored (an older copy, or one
 * with a write queued) deletes none.
 */
export async function putEntries(
  db: CommandsnippetsDatabase,
  owner: string,
  entries: readonly TextEntry[],
  included: readonly IncludedResource[] = [],
  force = false
): Promise<void> {
  const stored = await putNewer(db, db.entries, owner, entries, {
    tie: deletedStays,
    force,
  });
  await putJunctionsNewer(db, owner, included.filter(isJunction), force);
  for (const entry of stored) {
    const listed = new Set(
      entry.relationships.text_entry_to_tag.data.map(({id}) => id)
    );
    const left = (
      await db.junctions
        .where('[owner+relationships.text_entry.data.id]')
        .equals([owner, entry.id])
        .toArray()
    ).filter(
      junction => !junction.attributes.is_deleted && !listed.has(junction.id)
    );
    const queued = await queuedFor(db, owner, left);
    await db.junctions.bulkPut(
      left
        .filter(
          junction => !queued.has(rowKey(owner, junction.type, junction.id))
        )
        .map(junction => ({
          ...junction,
          attributes: {...junction.attributes, is_deleted: true},
        }))
    );
  }
}

/** Store `owner`'s `tags`. */
export async function putTags(
  db: CommandsnippetsDatabase,
  owner: string,
  tags: readonly Tag[],
  force = false
): Promise<void> {
  await putNewer(db, db.tags, owner, tags, {force});
}

/**
 * Store a tag's junctions (deleted ones too, with the revisions the API gave
 * them) and the entries included with them, with their junctions.
 */
export async function putJunctions(
  db: CommandsnippetsDatabase,
  owner: string,
  junctions: readonly TagTextEntry[],
  included: readonly IncludedResource[] = []
): Promise<void> {
  await putJunctionsNewer(db, owner, junctions);
  await putEntries(db, owner, included.filter(isEntry), included);
}

const isTag = (resource: IncludedResource): resource is Tag =>
  resource.type === 'Tag';

/**
 * Store an answer from the API (its `data` and `included`) under `owner`:
 * tags, entries with their junctions, and junctions whose entries are not
 * among them. A write's answer is stored with `force`.
 */
export async function putResources(
  db: CommandsnippetsDatabase,
  owner: string,
  resources: readonly IncludedResource[],
  force = false
): Promise<void> {
  await db.transaction(
    'rw',
    [db.tags, db.entries, db.junctions, db.outbox],
    async () => {
      await putTags(db, owner, resources.filter(isTag), force);
      const entries = resources.filter(isEntry);
      const entryIds = new Set(entries.map(({id}) => id));
      const junctions = resources.filter(isJunction);
      await putJunctionsNewer(
        db,
        owner,
        junctions.filter(
          junction => !entryIds.has(junction.relationships.text_entry.data.id)
        ),
        force
      );
      await putEntries(db, owner, entries, junctions, force);
    }
  );
}
