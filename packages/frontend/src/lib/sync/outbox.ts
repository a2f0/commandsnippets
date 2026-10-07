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
 *   (unless another write to it is still queued). A reorder answers
 *   nothing, so once the API has made it, a read of the rows it ranks (the
 *   tags, or the tag's junctions) takes its place in the queue
 *   (`refreshTags`, `refreshJunctions`): the one it moved, which a sync
 *   left as it was while the reorder was queued (and may not read again),
 *   and those it shifted. A failed read is retried alone: a reorder is sent
 *   once. When a sync later reads
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
 *   A queued create sends its local id as `client_id`, so one retried after
 *   a lost answer is made once, and a sync that reads the row it made first
 *   (the API renders `client_id`) adopts it: the create is unqueued and the
 *   API's id replaces the local one, as the answer would have
 *   (`adoptCreates`), so the row is never shown twice.
 * - **Failures.** A write that fails for a reason that can pass (offline, a
 *   5xx) stops the flush: it is tried again on the next. One the API refuses
 *   (a 400 or 404) is dropped, with the writes that needed it, and the rows
 *   they changed are put back as the API holds them: by restores queued in
 *   their place (`restoreTag`, ...), which are retried like any write, so a
 *   refused write never stays shown (a sync would not bring back a row the
 *   API never changed).
 */
import {CURSOR_START, cursorOf} from '@commandsnippets/api-shared/cursor';
import {formatMicros} from '@commandsnippets/api-shared/datetime';
import type {TagReorderDocument} from '@commandsnippets/api-shared/requests';
import type {
  IncludedResource,
  TagCursorListDocument,
  TagDocument,
  TagTextEntryCursorListDocument,
  TagTextEntryDocument,
  TagTextEntryListDocument,
  TextEntryDocument,
} from '@commandsnippets/api-shared/responses';
import type {Table} from 'dexie';
import {ApiRequestError, UserMismatchError} from '../api/apiClient';
import {
  type CommandsnippetsDatabase,
  MADE_KEY,
  type OutboxRow,
  OWNER_ID_KEY,
  type QueuedWrite,
  type RowKey,
  rowKey,
  type Stored,
} from '../db/database';
import {assertHeld, heldVersion} from './dataVersion';
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

/** Where this browser keeps the last time a write was made here. */
export const LAST_MADE_KEY = 'commandsnippets-last-made';

let lastMade = 0;

/**
 * Now, in the API's datetime form: when a write is made. Always later than
 * the last write made in this browser (in any tab, before any reload), so a
 * clock set back never makes a later write older than one queued before it,
 * which the API would then discard (last writer wins).
 */
export function madeNow(): string {
  let stored = 0;
  try {
    stored = Number(globalThis.localStorage?.getItem(LAST_MADE_KEY) ?? 0) || 0;
  } catch {
    // Storage unavailable: this page's own writes still stay in order.
  }
  const micros = Math.max(Date.now() * 1000, Math.max(lastMade, stored) + 1);
  lastMade = micros;
  try {
    globalThis.localStorage?.setItem(LAST_MADE_KEY, String(micros));
  } catch {
    // As above.
  }
  return formatMicros(micros);
}

/** A microsecond after `time` (the API's fixed-width datetime form). */
function justAfter(time: string): string {
  const seconds = Date.parse(`${time.slice(0, 19)}Z`);
  return formatMicros(seconds * 1000 + Number(time.slice(20, 26)) + 1);
}

/**
 * When a write is made, in the transaction that queues it (one including
 * `cursors`): after the last write queued in `owner`'s data, by any tab
 * (IndexedDB runs the transactions one at a time), and no earlier than this
 * browser's last (`madeNow`). No two writes share a time, and none is made
 * before one queued ahead of it.
 */
export async function nextMade(
  db: CommandsnippetsDatabase,
  owner: string
): Promise<string> {
  const now = madeNow();
  const last = (await db.cursors.get([owner, MADE_KEY]))?.after;
  const made = last !== undefined && last >= now ? justAfter(last) : now;
  await db.cursors.put({owner, key: MADE_KEY, after: made});
  return made;
}

/** The API calls the queue makes (`apiClient`'s). */
export interface OutboxApi {
  /** These calls, naming the queued write `writeId` (`Client-Write-Id`). */
  forWrite(writeId: string): OutboxApi;
  /** These calls, naming the account `userId` (`X-Expected-User-Id`). */
  forAccount(userId: string): OutboxApi;
  /** These calls, naming the data version `version` (`X-Data-Version`). */
  forVersion(version: number): OutboxApi;
  createTag(
    name: string,
    clientId?: string,
    made?: string
  ): Promise<TagDocument>;
  keepTag(tagId: string, made?: string): Promise<TagDocument>;
  updateTag(tagId: string, name: string, made?: string): Promise<TagDocument>;
  setTagPublic(
    tagId: string,
    isPublic: boolean,
    made?: string
  ): Promise<TagDocument>;
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
  setEntryPublic(
    entryId: string,
    isPublic: boolean,
    made?: string
  ): Promise<TextEntryDocument>;
  tagEntry(
    tagId: string,
    entryId: string,
    made?: string
  ): Promise<TagTextEntryDocument>;
  untagEntry(junctionId: string, made?: string): Promise<TagTextEntryDocument>;
  reorderEntry(top: string, bottom: string, made?: string): Promise<void>;
  getTag(tagId: string): Promise<TagDocument>;
  getTagsAfter(after: string): Promise<TagCursorListDocument>;
  getTagJunctionsAfter(
    tagId: string,
    after: string
  ): Promise<TagTextEntryCursorListDocument>;
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
    case 'keepTag':
    case 'renameTag':
    case 'setTagPublic':
    case 'deleteTag':
      return [rowKey(owner, TAG, write.tagId)];
    case 'reorderTags':
      return [rowKey(owner, TAG, write.top)];
    case 'createEntry':
    case 'updateEntry':
    case 'setEntryPublic':
    case 'deleteEntry':
      return [rowKey(owner, TEXT_ENTRY, write.entryId)];
    // The tag and the entry too: their counts changed.
    case 'tagEntry':
    case 'untagEntry':
      return [
        rowKey(owner, JUNCTION, write.junctionId),
        rowKey(owner, TAG, write.tagId),
        rowKey(owner, TEXT_ENTRY, write.entryId),
      ];
    case 'reorderEntries':
      return [rowKey(owner, JUNCTION, write.top)];
    // A read holds no row: what a sync stores meanwhile stands too.
    case 'refreshTags':
    case 'refreshJunctions':
    case 'restoreTag':
    case 'restoreEntry':
    case 'restoreJunction':
      return [];
  }
}

/** The ids a write names, as `[type, id]`. */
function idsOf(write: QueuedWrite): Array<[string, string]> {
  switch (write.kind) {
    case 'createTag':
    case 'keepTag':
    case 'renameTag':
    case 'setTagPublic':
    case 'deleteTag':
      return [[TAG, write.tagId]];
    case 'reorderTags':
      return [
        [TAG, write.top],
        [TAG, write.bottom],
      ];
    case 'createEntry':
    case 'updateEntry':
    case 'setEntryPublic':
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
    case 'refreshTags':
      return [];
    case 'refreshJunctions':
    case 'restoreTag':
      return [[TAG, write.tagId]];
    case 'restoreEntry':
      return [[TEXT_ENTRY, write.entryId]];
    case 'restoreJunction':
      return [
        [JUNCTION, write.junctionId],
        [TAG, write.tagId],
        [TEXT_ENTRY, write.entryId],
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
    case 'keepTag':
    case 'renameTag':
    case 'setTagPublic':
    case 'deleteTag':
      return type === TAG ? {...write, tagId: swap(write.tagId)} : write;
    case 'reorderTags':
      return type === TAG
        ? {...write, top: swap(write.top), bottom: swap(write.bottom)}
        : write;
    case 'createEntry':
    case 'updateEntry':
    case 'setEntryPublic':
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
    // Reads name the API's ids only: nothing to rename.
    case 'refreshTags':
    case 'refreshJunctions':
    case 'restoreTag':
    case 'restoreEntry':
    case 'restoreJunction':
      return write;
  }
}

/** Queue `owner`'s `write`, made at `made` (call inside the write's transaction). */
export async function enqueue(
  db: CommandsnippetsDatabase,
  owner: string,
  write: QueuedWrite,
  made: string
): Promise<void> {
  const version = await heldVersion(db, owner);
  await db.outbox.add({
    owner,
    made,
    writeId: globalThis.crypto.randomUUID(),
    ...(version === undefined ? {} : {version}),
    write,
    rows: rowsOf(owner, write),
  });
}

/** A local id replaced by the API's, once its create reached the API. */
export interface Remap {
  owner: string;
  type: string;
  from: string;
  to: string;
}

const remapListeners = new Set<(remap: Remap) => void>();

// Every tab hears of a remap (each keeps its own selection), the flushing
// one directly and the others over this channel.
const remapChannel =
  typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel('commandsnippets-remaps');

function notifyRemap(remap: Remap): void {
  for (const listener of remapListeners) {
    listener(remap);
  }
}

if (remapChannel !== null) {
  remapChannel.onmessage = ({data}: MessageEvent<Remap>) => notifyRemap(data);
}

/** Tell this tab and the others of `remaps`, once they are stored. */
export function announceRemaps(remaps: readonly Remap[]): void {
  for (const remap of remaps) {
    notifyRemap(remap);
    remapChannel?.postMessage(remap);
  }
}

/**
 * Call `listener` whenever a local id is replaced by the API's, in this tab
 * or another (for state that holds ids, like the UI's selection). Returns
 * the unsubscribe.
 */
export function subscribeRemaps(listener: (remap: Remap) => void): () => void {
  remapListeners.add(listener);
  return () => {
    remapListeners.delete(listener);
  };
}

/**
 * What a sent write brought back: rows to store, a create's new id, a row
 * the API no longer has (a restore's), which goes, and what is left to do.
 */
interface Sent {
  resources: IncludedResource[];
  created?: {type: string; from: string; to: string};
  gone?: [string, string];
  /** The write that takes this one's place in the queue (a reorder's read). */
  next?: QueuedWrite;
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
      const document = await api.createTag(write.name, write.tagId, made);
      return {
        resources: answer(document),
        created: {type: TAG, from: write.tagId, to: document.data.id},
      };
    }
    case 'keepTag':
      return {resources: answer(await api.keepTag(write.tagId, made))};
    case 'renameTag':
      return {
        resources: answer(await api.updateTag(write.tagId, write.name, made)),
      };
    case 'setTagPublic':
      return {
        resources: answer(
          await api.setTagPublic(write.tagId, write.isPublic, made)
        ),
      };
    case 'setEntryPublic':
      return {
        resources: answer(
          await api.setEntryPublic(write.entryId, write.isPublic, made)
        ),
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
      // The answer is empty: the tags are read next (`refreshTags`).
      return {resources: [], next: {kind: 'refreshTags'}};
    case 'refreshTags':
      // The tags the reorder ranked: the one moved (which a sync left as it
      // was while it was queued, and may not read again) and those it
      // shifted, so their ranks are the API's together.
      return {resources: await everyPage(after => api.getTagsAfter(after))};
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
      return {
        resources: [],
        next: {kind: 'refreshJunctions', tagId: write.tagId},
      };
    case 'refreshJunctions':
      // Likewise the tag's junctions.
      return {
        resources: await everyPage(after =>
          api.getTagJunctionsAfter(write.tagId, after)
        ),
      };
    case 'restoreTag':
      return restoring(TAG, write.tagId, async () =>
        answer(await api.getTag(write.tagId))
      );
    case 'restoreEntry':
      return restoring(TEXT_ENTRY, write.entryId, async () =>
        answer(await api.getEntry(write.entryId))
      );
    case 'restoreJunction':
      return restoring(JUNCTION, write.junctionId, async () => {
        const {data, included} = await api.getJunction(
          write.tagId,
          write.entryId
        );
        return [...data, ...(included ?? [])];
      });
  }
}

/** Every page of a keyset listing (`read` after a cursor), with `included`. */
async function everyPage(
  read: (after: string) => Promise<{
    data: Array<IncludedResource & {attributes: {date_updated: string}}>;
    included?: IncludedResource[] | undefined;
    links: {next: string | null};
  }>
): Promise<IncludedResource[]> {
  const resources: IncludedResource[] = [];
  for (let after = CURSOR_START; ; ) {
    const page = await read(after);
    resources.push(...page.data, ...(page.included ?? []));
    const last = page.data.at(-1);
    if (page.links.next === null || last === undefined) {
      return resources;
    }
    after = cursorOf(last);
  }
}

/** A restore's read: the row as the API holds it, or gone (a 404). */
async function restoring(
  type: string,
  id: string,
  read: () => Promise<IncludedResource[]>
): Promise<Sent> {
  try {
    return {resources: await read()};
  } catch (error: unknown) {
    if (error instanceof ApiRequestError && error.status === 404) {
      return {resources: [], gone: [type, id]};
    }
    throw error;
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
 * The data was bound to another account (`bindOwner`: a sign-in here of
 * another account of the same name) while a flush or a sync was on its
 * way: what it brought is the first account's, and is not stored.
 */
export class AccountChangedError extends Error {
  constructor(owner: string) {
    super(`${owner}'s data was bound to another account meanwhile`);
    this.name = 'AccountChangedError';
  }
}

/**
 * Refuse (`AccountChangedError`) unless `owner`'s data is still bound to
 * `accountId` (in a transaction including `cursors`, before storing).
 */
export async function assertBound(
  db: CommandsnippetsDatabase,
  owner: string,
  accountId: string | undefined
): Promise<void> {
  const held = (await db.cursors.get([owner, OWNER_ID_KEY]))?.after;
  if (held !== accountId) {
    throw new AccountChangedError(owner);
  }
}

/**
 * The write reached the API: unqueue it (or put what is left to do in its
 * place), give a row it created the API's id, and store the answer, unless
 * the data was bound to another account meanwhile (`assertBound`), or held
 * at another data version than the write's (`assertHeld`).
 */
async function acknowledge(
  db: CommandsnippetsDatabase,
  queued: OutboxRow,
  sent: Sent,
  accountId: string | undefined
): Promise<Remap[]> {
  const {owner} = queued;
  const created = sent.created;
  // Only a local id is replaced (creates are queued for rows made here).
  const remapped =
    created !== undefined &&
    isLocalId(created.from) &&
    created.from !== created.to
      ? {owner, ...created}
      : null;
  let adopted: Remap[] = [];
  await db.transaction(
    'rw',
    [db.outbox, db.tags, db.entries, db.junctions, db.cursors],
    async () => {
      await assertBound(db, owner, accountId);
      await assertHeld(db, owner, queued.version);
      if (queued.seq !== undefined) {
        if (sent.next === undefined) {
          await db.outbox.delete(queued.seq);
        } else {
          await db.outbox.update(queued.seq, {
            write: sent.next,
            rows: rowsOf(owner, sent.next),
          });
        }
      }
      if (remapped !== null) {
        await remap(db, remapped);
      }
      if (sent.gone !== undefined) {
        const [type, id] = sent.gone;
        await tableOf(db, type).delete([owner, id]);
      }
      // What the answer shows the API has of other queued creates and
      // taggings (a retried create's entry, tagged by another device
      // meanwhile): adopted, as a sync's page is, never stored twice.
      adopted = await adoptCreates(db, owner, sent.resources);
      await putResources(db, owner, sent.resources, true);
    }
  );
  return [...(remapped === null ? [] : [remapped]), ...adopted];
}

/** The restore that puts `owner`'s row back as the API holds it, if any. */
async function restoreOf(
  db: CommandsnippetsDatabase,
  owner: string,
  [type, id]: [string, string]
): Promise<QueuedWrite | null> {
  if (type === TAG) {
    return {kind: 'restoreTag', tagId: id};
  }
  if (type === TEXT_ENTRY) {
    return {kind: 'restoreEntry', entryId: id};
  }
  const junction = await db.junctions.get([owner, id]);
  return junction === undefined
    ? null
    : {
        kind: 'restoreJunction',
        junctionId: id,
        tagId: junction.relationships.tag.data.id,
        entryId: junction.relationships.text_entry.data.id,
      };
}

/** Whether `write` only reads (a restore, or a reorder's refresh). */
const isRead = (write: QueuedWrite) =>
  write.kind === 'refreshTags' ||
  write.kind === 'refreshJunctions' ||
  write.kind === 'restoreTag' ||
  write.kind === 'restoreEntry' ||
  write.kind === 'restoreJunction';

/**
 * The API refused `queued` for good: drop it, and every queued write that
 * names a row it would have created (they cannot reach the API either). The
 * rows those creates made locally go; the API's rows they changed are put
 * back as the API holds them, by restores queued in their place.
 */
async function drop(
  db: CommandsnippetsDatabase,
  queued: OutboxRow,
  accountId: string | undefined
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
    // (A refused read is not queued again.)
    if (isRead(write.write)) {
      continue;
    }
    for (const [type, id] of idsOf(write.write)) {
      if (!isLocalId(id)) {
        held.set(`${type}:${id}`, [type, id]);
      }
    }
  }
  await db.transaction(
    'rw',
    [db.outbox, db.tags, db.entries, db.junctions, db.cursors],
    async () => {
      await assertBound(db, owner, accountId);
      await db.outbox.bulkDelete(
        [...dropped.keys()].filter(seq => seq !== undefined)
      );
      for (const [type, id] of lost.values()) {
        await tableOf(db, type).delete([owner, id]);
      }
      for (const id of held.values()) {
        const restore = await restoreOf(db, owner, id);
        if (restore !== null) {
          await enqueue(db, owner, restore, madeNow());
        }
      }
    }
  );
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
  // Each request names the account the data is bound to: refused when
  // signed in as another account, though of the same username.
  const accountId = (await db.cursors.get([owner, OWNER_ID_KEY]))?.after;
  const account = accountId === undefined ? api : api.forAccount(accountId);
  for (;;) {
    // Bound to another account since (a sign-in here): its queue is not
    // this flush's to send.
    await assertBound(db, owner, accountId);
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
      const named =
        queued.version === undefined
          ? account
          : account.forVersion(queued.version);
      sent = await send(
        named.forWrite(queued.writeId),
        queued.write,
        queued.made
      );
    } catch (error: unknown) {
      // Refused as another account's because the data was bound to it while
      // the request was on its way: no reason to leave its session.
      if (error instanceof UserMismatchError) {
        await assertBound(db, owner, accountId);
      }
      if (!refused(error)) {
        throw error;
      }
      console.error('ERROR: the API refused a queued write:', error);
      await drop(db, queued, accountId);
      continue;
    }
    announceRemaps(await acknowledge(db, queued, sent, accountId));
  }
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
  const made = new Map<string, IncludedResource>();
  const paired = new Map<string, string>();
  const pairOf = (tagId: string, entryId: string) => `${tagId}:${entryId}`;
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
  if (made.size === 0 && paired.size === 0) {
    return [];
  }
  const remaps: Remap[] = [];
  const queuedWrites = () => db.outbox.where('owner').equals(owner).toArray();
  for (const queued of await queuedWrites()) {
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
  // Then the taggings, as queued now: naming the API's ids of the tags and
  // entries just adopted.
  const taken = new Set<string>();
  for (const {write} of await queuedWrites()) {
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

/** How many writes `owner` has queued. */
export const queuedCount = (
  db: CommandsnippetsDatabase,
  owner: string
): Promise<number> => db.outbox.where('owner').equals(owner).count();
