/**
 * Which account an owner's data is bound to (`OWNER_ID_KEY`, in `cursors`):
 * kept data is bound to the account's id, so another account that takes a
 * deleted account's name never sees its data nor sends its queue.
 */
import {Dexie, type Table} from 'dexie';
import {
  type CommandsnippetsDatabase,
  databaseName,
  OWNER_ID_KEY,
  type RowKey,
  type Stored,
} from '../db/database';
import {environment} from '../environment';
import {heldVersion} from './dataVersion';
import type {OutboxApi} from './send';

/**
 * The account binding changed while an operation was pending, including a
 * first binding after an unbound capture. Refuse the old operation instead
 * of guessing its owner; a fresh attempt captures the current binding.
 */
export class AccountChangedError extends Error {
  constructor(owner: string) {
    super(`${owner}'s account binding changed meanwhile; try again`);
    this.name = 'AccountChangedError';
  }
}

/** The account `owner`'s data is bound to (`bindOwner`), if it is. */
export const boundAccount = async (
  db: CommandsnippetsDatabase,
  owner: string
): Promise<string | undefined> =>
  (await db.cursors.get([owner, OWNER_ID_KEY]))?.after;

/**
 * `api` naming the account `owner`'s data is bound to, and that account:
 * refused when signed in as another account, though of the same username.
 */
export async function forBoundAccount(
  db: CommandsnippetsDatabase,
  api: OutboxApi,
  owner: string
): Promise<{account: OutboxApi; accountId: string | undefined}> {
  const accountId = await boundAccount(db, owner);
  return {
    account: accountId === undefined ? api : api.forAccount(accountId),
    accountId,
  };
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
  const held = await boundAccount(db, owner);
  if (held !== accountId) {
    throw new AccountChangedError(owner);
  }
}

/**
 * `api` naming the account `owner`'s data is bound to and the data version
 * it holds, as the queue's requests name them.
 */
export async function readerOf(
  db: CommandsnippetsDatabase,
  api: OutboxApi,
  owner: string
): Promise<{
  named: OutboxApi;
  accountId: string | undefined;
  version: number | undefined;
}> {
  const {account, accountId} = await forBoundAccount(db, api, owner);
  const version = await heldVersion(db, owner);
  const named = version === undefined ? account : account.forVersion(version);
  return {named, accountId, version};
}

/** The account a stored row of `owner`'s in `table` names, if any does. */
const accountIn = async <
  R extends {relationships: {user: {data: {id: string}}}},
>(
  table: Table<Stored<R>, RowKey>,
  owner: string
): Promise<string | undefined> =>
  (
    await table
      .where('owner')
      .equals(owner)
      .filter(row => row.relationships.user.data.id !== '')
      .first()
  )?.relationships.user.data.id;

/** The account `owner`'s stored rows name, if any does. */
async function accountOfRows(
  db: CommandsnippetsDatabase,
  owner: string
): Promise<string | undefined> {
  return (
    (await accountIn(db.tags, owner)) ??
    (await accountIn(db.entries, owner)) ??
    (await accountIn(db.junctions, owner))
  );
}

/**
 * Bind `owner`'s data to the account the API reads under that name
 * (`ownerId`): data another account of the name left here (deleted since,
 * its name taken again) goes, queued writes and all, before any of it is
 * shown again or sent as this account's; for the signed-in user's own (the
 * database is theirs), so does every other user's data it holds (staff
 * read it). With `asRead` (the binding read before asking the API which
 * account it is), a binding made since (a sign-in here) stands: refused
 * (`AccountChangedError`) rather than undone.
 */
export async function bindOwner(
  db: CommandsnippetsDatabase,
  owner: string,
  ownerId: string,
  asRead?: {held: string | undefined}
): Promise<void> {
  await db.transaction(
    'rw',
    [db.tags, db.entries, db.junctions, db.cursors, db.outbox],
    async () => {
      const bound = await boundAccount(db, owner);
      if (asRead !== undefined && bound !== asRead.held) {
        throw new AccountChangedError(owner);
      }
      // Data kept from before accounts were bound (an older version's): its
      // rows name their account.
      const held = bound ?? (await accountOfRows(db, owner));
      if (held === ownerId) {
        await db.cursors.put({owner, key: OWNER_ID_KEY, after: ownerId});
        return;
      }
      if (held !== undefined) {
        if (db.name === databaseName(environment, owner)) {
          for (const table of [
            db.tags,
            db.entries,
            db.junctions,
            db.cursors,
            db.outbox,
          ]) {
            await table.clear();
          }
        } else {
          for (const table of [db.tags, db.entries, db.junctions, db.outbox]) {
            await table.where('owner').equals(owner).delete();
          }
          await db.cursors
            .where('[owner+key]')
            .between([owner, Dexie.minKey], [owner, Dexie.maxKey])
            .delete();
        }
      }
      await db.cursors.put({owner, key: OWNER_ID_KEY, after: ownerId});
    }
  );
}

/** Only a public cache uses this: never removes an owner's queued writes. */
export async function clearPublicOwner(
  db: CommandsnippetsDatabase,
  owner: string
): Promise<void> {
  await db.transaction(
    'rw',
    [db.tags, db.entries, db.junctions, db.cursors],
    async () => {
      for (const table of [db.tags, db.entries, db.junctions, db.cursors]) {
        await table.where('owner').equals(owner).delete();
      }
    }
  );
}
