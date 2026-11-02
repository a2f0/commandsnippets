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
 *
 * Its parts: what a write names (`queuedWrite.ts`), how one is sent
 * (`send.ts`), local ids (`localIds.ts`) and their replacement
 * (`adopt.ts`, `remaps.ts`), write times (`made.ts`) and the account the
 * data is bound to (`accountBinding.ts`).
 */
import type {TextEntryReusedListDocument} from '@commandsnippets/api-shared/responses';
import {ApiRequestError, UserMismatchError} from '../api/errors';
import type {
  CommandsnippetsDatabase,
  OutboxRow,
  QueuedWrite,
} from '../db/database';
import {assertBound, forBoundAccount, readerOf} from './accountBinding';
import {adoptCreates, remap, tableOf} from './adopt';
import {assertHeld, heldVersion} from './dataVersion';
import {isLocalId} from './localIds';
import {madeNow} from './made';
import {createdBy, idsOf, isRead, rowsOf, TAG, TEXT_ENTRY} from './queuedWrite';
import {announceRemaps, type Remap} from './remaps';
import {answer, type OutboxApi, type Sent, send} from './send';
import {putResources} from './store';

// The UI and its specs, outside this unit, still name it from here.
export {isLocalId} from './localIds';

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

/**
 * Whether the API refused the write for good (a 400 or 404): it is dropped.
 * Anything else (offline, a 5xx, a session gone) can pass: it is retried.
 */
const refused = (error: unknown): boolean =>
  error instanceof ApiRequestError &&
  (error.status === 400 || error.status === 404);

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
  // Each request names the account the data is bound to.
  const {account, accountId} = await forBoundAccount(db, api, owner);
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
 * Read `owner`'s entry `entryId` as the API holds it and store it (as a sync
 * would: a queued write to it still stands): what changes it without a new
 * revision, which the sync's cursors never see again (its reuse count, from
 * another device's copies). Call after a flush, under the same lock.
 */
export async function refreshEntry(
  db: CommandsnippetsDatabase,
  api: OutboxApi,
  owner: string,
  entryId: string
): Promise<void> {
  const {named, accountId, version} = await readerOf(db, api, owner);
  const document = await named.getEntry(entryId);
  await db.transaction(
    'rw',
    [db.outbox, db.tags, db.entries, db.junctions, db.cursors],
    async () => {
      await assertBound(db, owner, accountId);
      await assertHeld(db, owner, version);
      await putResources(db, owner, answer(document));
    }
  );
}

/** Read one history page, bound to the same account and data version. */
export async function readReuses(
  db: CommandsnippetsDatabase,
  api: OutboxApi,
  owner: string,
  entryId: string | undefined,
  page: number
): Promise<TextEntryReusedListDocument> {
  const {named, accountId, version} = await readerOf(db, api, owner);
  const listed = await named.getEntryReuses(entryId, page);
  await assertBound(db, owner, accountId);
  await assertHeld(db, owner, version);
  return listed;
}

/** How many writes `owner` has queued. */
export const queuedCount = (
  db: CommandsnippetsDatabase,
  owner: string
): Promise<number> => db.outbox.where('owner').equals(owner).count();
