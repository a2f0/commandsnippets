import type {Tag} from '@commandsnippets/api-shared/responses';
import {boundAccount} from '../sync/accountBinding';
import type {SyncSession} from '../sync/session';
import {rowNamed} from './queries';

/** A rename may follow its stored row, never a replacement account or write. */
export async function isCurrentTagRename(
  session: SyncSession,
  renamed: Tag,
  accountId: string
): Promise<boolean> {
  const {db, owner} = session;
  if (db.hasBeenClosed()) return false;
  try {
    return await db.transaction('r', [db.tags, db.cursors], async () => {
      const account = await boundAccount(db, owner);
      const current = await rowNamed(db.tags, owner, renamed.id);
      return (
        account === accountId &&
        renamed.relationships.user.data.id === accountId &&
        current?.relationships.user.data.id === account &&
        current.attributes.name === renamed.attributes.name &&
        !current.attributes.is_deleted
      );
    });
  } catch (error) {
    // The write already succeeded; losing this read must not report it unsaved.
    if (!db.hasBeenClosed()) {
      console.error('Failed to follow the renamed tag:', error);
    }
    return false;
  }
}
