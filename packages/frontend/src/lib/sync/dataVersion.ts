/**
 * Which data version (api-shared's `DataVersion`) an owner's rows here are
 * of: the user's active one when they were read (`VERSION_KEY`, in
 * `cursors`). Every sync reads the active one first (`bindToApi`) and asks
 * for its pages of that version (`X-Data-Version`), so no page of one is
 * stored among the rows of another; every queued write names the version
 * it was made against. When the active version is another (a restore, or
 * another made active, on any device), the owner's rows, cursors and queued
 * writes go (`adoptVersion`), and the next sync reads the new one from the
 * start. A version that is not active never changes, so rows held of the
 * active one are right however long ago they were read.
 */
import {DataVersionChangedError} from '../api/apiClient';
import {
  type CommandsnippetsDatabase,
  MADE_KEY,
  OWNER_ID_KEY,
  VERSION_KEY,
} from '../db/database';

/** The data version `owner`'s rows are of, if they have been read. */
export async function heldVersion(
  db: CommandsnippetsDatabase,
  owner: string
): Promise<number | undefined> {
  const held = (await db.cursors.get([owner, VERSION_KEY]))?.after;
  return held === undefined ? undefined : Number(held);
}

/**
 * Whether `owner`'s data here was read from the API: it has a cursor of a
 * read (anything but the account's and when the last write was made).
 */
async function wasRead(
  db: CommandsnippetsDatabase,
  owner: string
): Promise<boolean> {
  const read = await db.cursors
    .where('owner')
    .equals(owner)
    .filter(({key}) => key !== OWNER_ID_KEY && key !== MADE_KEY)
    .first();
  return read !== undefined;
}

/**
 * Hold `owner`'s rows at data version `version`. Rows of another go, with
 * every cursor but the account's (so the next sync reads from the start)
 * and the writes queued against them (the API would refuse them); so do
 * rows read with no version held, which are of none known. Data never read
 * holds only what was made here: it stays, and the writes queued before any
 * version was held are of this one. Returns whether rows went.
 */
export async function adoptVersion(
  db: CommandsnippetsDatabase,
  owner: string,
  version: number
): Promise<boolean> {
  return db.transaction(
    'rw',
    [db.tags, db.entries, db.junctions, db.cursors, db.outbox],
    async () => {
      const held = await heldVersion(db, owner);
      if (held === version) {
        return false;
      }
      const stale = held !== undefined || (await wasRead(db, owner));
      if (stale) {
        for (const table of [db.tags, db.entries, db.junctions, db.outbox]) {
          await table.where('owner').equals(owner).delete();
        }
        await db.cursors
          .where('owner')
          .equals(owner)
          .filter(cursor => cursor.key !== OWNER_ID_KEY)
          .delete();
      } else {
        await db.outbox
          .where('owner')
          .equals(owner)
          .filter(queued => queued.version === undefined)
          .modify({version});
      }
      await db.cursors.put({owner, key: VERSION_KEY, after: String(version)});
      return stale;
    }
  );
}

/**
 * Refuse (`DataVersionChangedError`) unless `owner`'s rows are still held at
 * `version` (none: not read at a version): in the transaction that stores
 * a page or an answer read of it, so none is stored among another's rows.
 */
export async function assertHeld(
  db: CommandsnippetsDatabase,
  owner: string,
  version: number | undefined
): Promise<void> {
  if (version !== undefined && (await heldVersion(db, owner)) !== version) {
    throw new DataVersionChangedError('Not stored');
  }
}
