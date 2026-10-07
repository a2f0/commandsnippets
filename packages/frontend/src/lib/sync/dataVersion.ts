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
import {
  type CommandsnippetsDatabase,
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
 * Hold `owner`'s rows at data version `version`: rows of another are
 * deleted, with every cursor but the account's (so the next sync reads from
 * the start) and the writes queued against them (the API would refuse
 * them). Returns whether it deleted them.
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
      if (held !== undefined) {
        for (const table of [db.tags, db.entries, db.junctions, db.outbox]) {
          await table.where('owner').equals(owner).delete();
        }
        await db.cursors
          .where('owner')
          .equals(owner)
          .filter(cursor => cursor.key !== OWNER_ID_KEY)
          .delete();
      }
      await db.cursors.put({owner, key: VERSION_KEY, after: String(version)});
      return held !== undefined;
    }
  );
}
