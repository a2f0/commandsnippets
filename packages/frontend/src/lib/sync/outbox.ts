/**
 * The queue of the user's writes (`outbox`): each write is stored at once
 * (`lib/data/writes.ts`), queued here in the same transaction, and sent to
 * the API later, in order (`flushOutbox`), so the app works offline and a
 * write never waits on the network.
 *
 * - **Pending rows.** A queued write names the rows it changed (`rowsOf`). A
 *   sync leaves those rows as they are until the write reaches the API
 *   (`store.ts`), so it never undoes the user's write with an older copy.
 * - **The answer.** Each write's answer is the row as the API holds it after
 *   the write, with its new revision: stored in place of the local row
 *   (unless another write to it is still queued). When a sync later reads
 *   that row, it holds the same revision and changes nothing: a device's own
 *   write costs it no re-sync. The cursors are never moved by an answer (a
 *   write's revision can be past another device's change the sync has not
 *   read).
 * - **Last writer wins.** Every write names when it was made (`made`, the
 *   API's `Client-Updated`): the API keeps the newer of two writes to a row
 *   whatever order they arrive in, and answers an older one with the row as
 *   it stands, which is then stored.
 * - **Local ids.** A row created offline has a local id (`local-...`) until
 *   its create reaches the API; the API's id then replaces it everywhere: in
 *   the rows, the queued writes, and the UI's selection (`subscribeRemaps`).
 *   A queued entry create sends its local id as `client_id`, so one retried
 *   after a lost answer is made once.
 * - **Failures.** A write that fails for a reason that can pass (offline, a
 *   5xx) stops the flush: it is tried again on the next. One the API refuses
 *   (a 400 or 404) is dropped, with the writes that needed it, and the rows
 *   they changed are put back as the API holds them.
 */
import {formatMicros} from '@commandsnippets/api-shared/datetime';
import type {TagReorderDocument} from '@commandsnippets/api-shared/requests';
import type {
  IncludedResource,
  TagDocument,
  TagTextEntryDocument,
  TagTextEntryListDocument,
  TextEntryDocument,
} from '@commandsnippets/api-shared/responses';
import type {Table} from 'dexie';
import {ApiRequestError} from '../api/apiClient';
import {
  type CommandsnippetsDatabase,
  type OutboxRow,
  type QueuedWrite,
  type RowKey,
  rowKey,
  type Stored,
} from '../db/database';
import {putResources} from './store';

const TAG = 'Tag';
const TEXT_ENTRY = 'TextEntry';
const JUNCTION = 'TagTextEntryThroughModel';

const LOCAL_ID_PREFIX = 'local-';

/** A new local id, for a row not created on the API yet. */
export const localId = (): string =>
  `${LOCAL_ID_PREFIX}${globalThis.crypto.randomUUID()}`;

/** Whether `id` is a local one: the row is not on the API yet. */
export const isLocalId = (id: string): boolean =>
  id.startsWith(LOCAL_ID_PREFIX);

/** Now, in the API's datetime form: when a write is made. */
export const madeNow = (): string => formatMicros(Date.now() * 1000);

/** The API calls the queue makes (`apiClient`'s). */
export interface OutboxApi {
  createTag(name: string, made?: string): Promise<TagDocument>;
  updateTag(tagId: string, name: string, made?: string): Promise<TagDocument>;
  deleteTag(tagId: string, made?: string): Promise<TagDocument>;
  reorderTag(payload: TagReorderDocument, made?: string): Promise<void>;
  createEntry(
    subject: string,
    body: string,
    clientId?: string,
    made?: string
  ): Promise<TextEntryDocument>;
  updateEntry(
    entryId: string,
    subject: string,
    body: string,
    made?: string
  ): Promise<TextEntryDocument>;
  deleteEntry(entryId: string, made?: string): Promise<TextEntryDocument>;
  tagEntry(
    tagId: string,
    entryId: string,
    made?: string
  ): Promise<TagTextEntryDocument>;
  untagEntry(junctionId: string, made?: string): Promise<TagTextEntryDocument>;
  reorderEntry(top: string, bottom: string, made?: string): Promise<void>;
  getTag(tagId: string): Promise<TagDocument>;
  getEntry(entryId: string): Promise<TextEntryDocument>;
  getJunction(
    tagId: string,
    entryId: string
  ): Promise<TagTextEntryListDocument>;
}

/** The rows a write changes locally (`rowKey`s): pending until it is sent. */
export function rowsOf(owner: string, write: QueuedWrite): string[] {
  switch (write.kind) {
    case 'createTag':
    case 'renameTag':
    case 'deleteTag':
      return [rowKey(owner, TAG, write.tagId)];
    case 'reorderTags':
      return [rowKey(owner, TAG, write.top)];
    case 'createEntry':
    case 'updateEntry':
    case 'deleteEntry':
      return [rowKey(owner, TEXT_ENTRY, write.entryId)];
    case 'tagEntry':
    case 'untagEntry':
      return [
        rowKey(owner, JUNCTION, write.junctionId),
        rowKey(owner, TEXT_ENTRY, write.entryId),
      ];
    case 'reorderEntries':
      return [rowKey(owner, JUNCTION, write.top)];
  }
}

/** The ids a write names, as `[type, id]`. */
function idsOf(write: QueuedWrite): Array<[string, string]> {
  switch (write.kind) {
    case 'createTag':
    case 'renameTag':
    case 'deleteTag':
      return [[TAG, write.tagId]];
    case 'reorderTags':
      return [
        [TAG, write.top],
        [TAG, write.bottom],
      ];
    case 'createEntry':
    case 'updateEntry':
    case 'deleteEntry':
      return [[TEXT_ENTRY, write.entryId]];
    case 'tagEntry':
    case 'untagEntry':
      return [
        [JUNCTION, write.junctionId],
        [TAG, write.tagId],
        [TEXT_ENTRY, write.entryId],
      ];
    case 'reorderEntries':
      return [
        [TAG, write.tagId],
        [JUNCTION, write.top],
        [JUNCTION, write.bottom],
      ];
  }
}

/** The row a write creates, when it creates one: `[type, id]`. */
function createdBy(write: QueuedWrite): [string, string] | null {
  switch (write.kind) {
    case 'createTag':
      return [TAG, write.tagId];
    case 'createEntry':
      return [TEXT_ENTRY, write.entryId];
    case 'tagEntry':
      return [JUNCTION, write.junctionId];
    default:
      return null;
  }
}

/** `write` with the id `from` (of a row of `type`) replaced by `to`. */
function renamed(
  write: QueuedWrite,
  type: string,
  from: string,
  to: string
): QueuedWrite {
  const swap = (id: string) => (id === from ? to : id);
  switch (write.kind) {
    case 'createTag':
    case 'renameTag':
    case 'deleteTag':
      return type === TAG ? {...write, tagId: swap(write.tagId)} : write;
    case 'reorderTags':
      return type === TAG
        ? {...write, top: swap(write.top), bottom: swap(write.bottom)}
        : write;
    case 'createEntry':
    case 'updateEntry':
    case 'deleteEntry':
      return type === TEXT_ENTRY
        ? {...write, entryId: swap(write.entryId)}
        : write;
    case 'tagEntry':
    case 'untagEntry':
      return {
        ...write,
        junctionId:
          type === JUNCTION ? swap(write.junctionId) : write.junctionId,
        tagId: type === TAG ? swap(write.tagId) : write.tagId,
        entryId: type === TEXT_ENTRY ? swap(write.entryId) : write.entryId,
      };
    case 'reorderEntries':
      return {
        ...write,
        tagId: type === TAG ? swap(write.tagId) : write.tagId,
        top: type === JUNCTION ? swap(write.top) : write.top,
        bottom: type === JUNCTION ? swap(write.bottom) : write.bottom,
      };
  }
}

/** Queue `owner`'s `write`, made at `made` (call inside the write's transaction). */
export async function enqueue(
  db: CommandsnippetsDatabase,
  owner: string,
  write: QueuedWrite,
  made: string
): Promise<void> {
  await db.outbox.add({owner, made, write, rows: rowsOf(owner, write)});
}

/** A local id replaced by the API's, once its create reached the API. */
export interface Remap {
  owner: string;
  type: string;
  from: string;
  to: string;
}

const remapListeners = new Set<(remap: Remap) => void>();

/**
 * Call `listener` whenever a local id is replaced by the API's (for state
 * that holds ids, like the UI's selection). Returns the unsubscribe.
 */
export function subscribeRemaps(listener: (remap: Remap) => void): () => void {
  remapListeners.add(listener);
  return () => {
    remapListeners.delete(listener);
  };
}

/** What a sent write brought back: rows to store, and a create's new id. */
interface Sent {
  resources: IncludedResource[];
  created?: {type: string; from: string; to: string};
}

const answer = (document: {
  data: IncludedResource;
  included?: IncludedResource[] | undefined;
}): IncludedResource[] => [document.data, ...(document.included ?? [])];

/** Send one queued write. */
async function send(
  api: OutboxApi,
  write: QueuedWrite,
  made: string
): Promise<Sent> {
  switch (write.kind) {
    case 'createTag': {
      const document = await api.createTag(write.name, made);
      return {
        resources: answer(document),
        created: {type: TAG, from: write.tagId, to: document.data.id},
      };
    }
    case 'renameTag':
      return {
        resources: answer(await api.updateTag(write.tagId, write.name, made)),
      };
    case 'deleteTag':
      return {resources: answer(await api.deleteTag(write.tagId, made))};
    case 'reorderTags':
      await api.reorderTag(
        {
          data: {
            type: 'Tag',
            attributes: {top: write.top, bottom: write.bottom},
            relationships: {},
          },
        },
        made
      );
      return {resources: []};
    case 'createEntry': {
      const document = await api.createEntry(
        write.subject,
        write.body,
        write.entryId,
        made
      );
      return {
        resources: answer(document),
        created: {type: TEXT_ENTRY, from: write.entryId, to: document.data.id},
      };
    }
    case 'updateEntry':
      return {
        resources: answer(
          await api.updateEntry(write.entryId, write.subject, write.body, made)
        ),
      };
    case 'deleteEntry':
      return {resources: answer(await api.deleteEntry(write.entryId, made))};
    case 'tagEntry': {
      const document = await api.tagEntry(write.tagId, write.entryId, made);
      return {
        resources: answer(document),
        created: {type: JUNCTION, from: write.junctionId, to: document.data.id},
      };
    }
    case 'untagEntry':
      return {
        resources: answer(await api.untagEntry(write.junctionId, made)),
      };
    case 'reorderEntries':
      await api.reorderEntry(write.top, write.bottom, made);
      return {resources: []};
  }
}

/**
 * Whether the API refused the write for good (a 400 or 404): it is dropped.
 * Anything else (offline, a 5xx, a session gone) can pass: it is retried.
 */
const refused = (error: unknown): boolean =>
  error instanceof ApiRequestError &&
  (error.status === 400 || error.status === 404);

/**
 * Move `owner`'s row `from` to the id `to`, unless the table has a row `to`
 * already (a create the API answered with a row it had: a tag of the name).
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
  if ((await table.get([owner, to])) === undefined) {
    await table.put({...local, id: to});
  }
}

/** The table holding rows of `type`. */
function tableOf(db: CommandsnippetsDatabase, type: string) {
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
async function remap(
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

/**
 * The write reached the API: unqueue it, give a row it created the API's
 * id, and store the answer.
 */
async function acknowledge(
  db: CommandsnippetsDatabase,
  queued: OutboxRow,
  sent: Sent
): Promise<Remap | null> {
  const {owner} = queued;
  const created = sent.created;
  const remapped =
    created !== undefined && created.from !== created.to
      ? {owner, ...created}
      : null;
  await db.transaction(
    'rw',
    [db.outbox, db.tags, db.entries, db.junctions],
    async () => {
      if (queued.seq !== undefined) {
        await db.outbox.delete(queued.seq);
      }
      if (remapped !== null) {
        await remap(db, remapped);
      }
      await putResources(db, owner, sent.resources, true);
    }
  );
  return remapped;
}

/**
 * Put back, as the API holds them, the rows the API-held ids name: the
 * writes that changed them were dropped. A row it no longer has goes.
 */
async function restore(
  db: CommandsnippetsDatabase,
  api: OutboxApi,
  owner: string,
  ids: ReadonlyArray<[string, string]>
): Promise<void> {
  for (const [type, id] of ids) {
    try {
      if (type === TAG) {
        await putResources(db, owner, answer(await api.getTag(id)), true);
      } else if (type === TEXT_ENTRY) {
        await putResources(db, owner, answer(await api.getEntry(id)), true);
      } else {
        const junction = await db.junctions.get([owner, id]);
        if (junction !== undefined) {
          const {data, included} = await api.getJunction(
            junction.relationships.tag.data.id,
            junction.relationships.text_entry.data.id
          );
          await putResources(db, owner, [...data, ...(included ?? [])], true);
        }
      }
    } catch (error: unknown) {
      if (error instanceof ApiRequestError && error.status === 404) {
        await tableOf(db, type).delete([owner, id]);
      } else {
        console.error(`ERROR: could not restore ${type} ${id}:`, error);
      }
    }
  }
}

/**
 * The API refused `queued` for good: drop it, and every queued write that
 * names a row it would have created (they cannot reach the API either). The
 * rows those creates made locally go; the API's rows they changed are put
 * back as the API holds them.
 */
async function drop(
  db: CommandsnippetsDatabase,
  api: OutboxApi,
  queued: OutboxRow
): Promise<void> {
  const {owner} = queued;
  const all = await db.outbox.where('owner').equals(owner).toArray();
  const dropped = new Map<number | undefined, OutboxRow>([
    [queued.seq, queued],
  ]);
  // The rows made locally by the dropped creates, by `${type}:${id}`.
  const lost = new Map<string, [string, string]>();
  const loseCreated = (write: QueuedWrite) => {
    const created = createdBy(write);
    if (created !== null && isLocalId(created[1])) {
      lost.set(created.join(':'), created);
    }
  };
  loseCreated(queued.write);
  for (let changed = true; changed; ) {
    changed = false;
    for (const other of all) {
      if (
        !dropped.has(other.seq) &&
        idsOf(other.write).some(id => lost.has(id.join(':')))
      ) {
        dropped.set(other.seq, other);
        loseCreated(other.write);
        changed = true;
      }
    }
  }
  const held = new Map<string, [string, string]>();
  for (const write of dropped.values()) {
    for (const [type, id] of idsOf(write.write)) {
      if (!isLocalId(id)) {
        held.set(`${type}:${id}`, [type, id]);
      }
    }
  }
  await db.transaction(
    'rw',
    [db.outbox, db.tags, db.entries, db.junctions],
    async () => {
      await db.outbox.bulkDelete(
        [...dropped.keys()].filter(seq => seq !== undefined)
      );
      for (const [type, id] of lost.values()) {
        await tableOf(db, type).delete([owner, id]);
      }
    }
  );
  await restore(db, api, owner, [...held.values()]);
}

/**
 * Send `owner`'s queued writes in order until none are left, storing each
 * answer. Throws at a write that failed for a reason that can pass (it stays
 * queued, for the next flush); drops one the API refused (see `drop`).
 */
export async function flushOutbox(
  db: CommandsnippetsDatabase,
  api: OutboxApi,
  owner: string
): Promise<void> {
  for (;;) {
    const queued = await db.outbox.where('owner').equals(owner).first();
    if (queued === undefined) {
      return;
    }
    let sent: Sent;
    try {
      // A write naming a row whose create never reached the API cannot (the
      // row it creates itself aside).
      const creates = createdBy(queued.write)?.[1];
      if (
        idsOf(queued.write).some(([, id]) => isLocalId(id) && id !== creates)
      ) {
        throw new ApiRequestError(
          'Queued write',
          400,
          'its row was never made'
        );
      }
      sent = await send(api, queued.write, queued.made);
    } catch (error: unknown) {
      if (!refused(error)) {
        throw error;
      }
      console.error('ERROR: the API refused a queued write:', error);
      await drop(db, api, queued);
      continue;
    }
    const remapped = await acknowledge(db, queued, sent);
    if (remapped !== null) {
      for (const listener of remapListeners) {
        listener(remapped);
      }
    }
  }
}

/** How many writes `owner` has queued. */
export const queuedCount = (
  db: CommandsnippetsDatabase,
  owner: string
): Promise<number> => db.outbox.where('owner').equals(owner).count();
