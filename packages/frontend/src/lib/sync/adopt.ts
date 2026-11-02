/**
 * Giving a row made here the API's id: once its create's answer comes
 * (`remap`), or when a sync reads the row the create made first
 * (`adoptCreates`), so the row is never shown twice.
 */
import type {IncludedResource} from '@commandsnippets/api-shared/responses';
import type {Table} from 'dexie';
import type {CommandsnippetsDatabase, RowKey, Stored} from '../db/database';
import {isLocalId} from './localIds';
import {
  createdBy,
  JUNCTION,
  renamed,
  rowsOf,
  TAG,
  TEXT_ENTRY,
} from './queuedWrite';
import type {Remap} from './remaps';
import {putResources} from './store';

/**
 * Move `owner`'s row `from` to the id `to`. It keeps its local id, so the UI
 * keys it the same (an editor open on it stays open). A row `to` the table
 * has already (the API's answer to this create, synced before a lost answer
 * was retried; a tag of the name another device made) is taken over: the
 * local row is the user's latest, until the API's answer (stored next) or
 * a later write's replaces it.
 */
async function rekey<R extends {id: string}>(
  table: Table<Stored<R>, RowKey>,
  owner: string,
  from: string,
  to: string
): Promise<void> {
  const local = await table.get([owner, from]);
  if (local === undefined) {
    return;
  }
  await table.delete([owner, from]);
  await table.put({...local, id: to, localId: local.localId ?? from});
}

/** The table holding rows of `type`. */
export function tableOf(db: CommandsnippetsDatabase, type: string) {
  return type === TAG
    ? db.tags
    : type === TEXT_ENTRY
      ? db.entries
      : db.junctions;
}

/**
 * Replace the local id `from` (of a row of `type`) by the API's `to`: the
 * row, the junctions naming it, and the queued writes. The row keeps the
 * user's local state until the API's answer (or a sync) replaces it.
 */
export async function remap(
  db: CommandsnippetsDatabase,
  {owner, type, from, to}: Remap
): Promise<void> {
  if (type === TAG) {
    await rekey(db.tags, owner, from, to);
  } else if (type === TEXT_ENTRY) {
    await rekey(db.entries, owner, from, to);
  } else {
    await rekey(db.junctions, owner, from, to);
  }
  if (type === TAG) {
    await db.junctions
      .where('[owner+relationships.tag.data.id]')
      .equals([owner, from])
      .modify(junction => {
        junction.relationships.tag.data.id = to;
      });
  }
  if (type === TEXT_ENTRY) {
    await db.junctions
      .where('[owner+relationships.text_entry.data.id]')
      .equals([owner, from])
      .modify(junction => {
        junction.relationships.text_entry.data.id = to;
      });
  }
  await db.outbox
    .where('owner')
    .equals(owner)
    .modify(queued => {
      queued.write = renamed(queued.write, type, from, to);
      queued.rows = rowsOf(owner, queued.write);
    });
}

const pairOf = (tagId: string, entryId: string) => `${tagId}:${entryId}`;

/**
 * What `resources` (a sync's page, a write's answer) show the API made of
 * this client's creates: rows by `${type}:${client_id}` (a local id), and
 * junction ids by their pair (`pairOf`).
 */
function clientMade(resources: readonly IncludedResource[]): {
  made: Map<string, IncludedResource>;
  paired: Map<string, string>;
} {
  const made = new Map<string, IncludedResource>();
  const paired = new Map<string, string>();
  for (const resource of resources) {
    if (resource.type === JUNCTION) {
      paired.set(
        pairOf(
          resource.relationships.tag.data.id,
          resource.relationships.text_entry.data.id
        ),
        resource.id
      );
      continue;
    }
    const clientId =
      resource.type === TAG || resource.type === TEXT_ENTRY
        ? resource.attributes.client_id
        : undefined;
    if (
      typeof clientId === 'string' &&
      isLocalId(clientId) &&
      clientId !== resource.id
    ) {
      made.set(`${resource.type}:${clientId}`, resource);
    }
  }
  return {made, paired};
}

const queuedWrites = (db: CommandsnippetsDatabase, owner: string) =>
  db.outbox.where('owner').equals(owner).toArray();

/** Unqueue each create `made` has the row of, which takes its id and copy. */
async function adoptQueuedCreates(
  db: CommandsnippetsDatabase,
  owner: string,
  made: ReadonlyMap<string, IncludedResource>
): Promise<Remap[]> {
  const remaps: Remap[] = [];
  for (const queued of await queuedWrites(db, owner)) {
    const created = createdBy(queued.write);
    const resource = created === null ? undefined : made.get(created.join(':'));
    if (created === null || resource === undefined) {
      continue;
    }
    if (queued.seq !== undefined) {
      await db.outbox.delete(queued.seq);
    }
    const adopted = {
      owner,
      type: created[0],
      from: created[1],
      to: resource.id,
    };
    await remap(db, adopted);
    await putResources(db, owner, [resource], true);
    remaps.push(adopted);
  }
  return remaps;
}

/**
 * Give each queued tagging the id of the junction `paired` has of its pair.
 * Read the queue afresh: it names the API's ids of the tags and entries
 * just adopted.
 */
async function adoptTaggings(
  db: CommandsnippetsDatabase,
  owner: string,
  paired: ReadonlyMap<string, string>
): Promise<Remap[]> {
  const remaps: Remap[] = [];
  const taken = new Set<string>();
  for (const {write} of await queuedWrites(db, owner)) {
    if (write.kind !== 'tagEntry' || !isLocalId(write.junctionId)) {
      continue;
    }
    const to = paired.get(pairOf(write.tagId, write.entryId));
    if (to === undefined || taken.has(write.junctionId)) {
      continue;
    }
    const junction = {owner, type: JUNCTION, from: write.junctionId, to};
    await remap(db, junction);
    taken.add(write.junctionId);
    remaps.push(junction);
  }
  return remaps;
}

/**
 * The creates still queued that `resources` (a sync's page) show the API
 * made already: a row whose `client_id` is the local id of one (its answer
 * was lost). Each is unqueued, and its row takes the API's id and copy, as
 * the answer would have done, before the page is stored: so the sync never
 * shows the row twice (local and the API's), and a later write to it goes
 * to the API's. A queued tagging whose pair (tag and entry) the page has a
 * junction of (its answer was lost, or another device tagged it) takes
 * that junction's id the same way, but stays queued: the API records when
 * it was made. Call inside the page's transaction; announce the remaps it
 * returns (`announceRemaps`) once it commits.
 */
export async function adoptCreates(
  db: CommandsnippetsDatabase,
  owner: string,
  resources: readonly IncludedResource[]
): Promise<Remap[]> {
  const {made, paired} = clientMade(resources);
  if (made.size === 0 && paired.size === 0) {
    return [];
  }
  return [
    ...(await adoptQueuedCreates(db, owner, made)),
    ...(await adoptTaggings(db, owner, paired)),
  ];
}
