import type {Tag} from '@commandsnippets/api-shared/responses';
import {boundAccount} from '../sync/accountBinding';
import {heldVersion} from '../sync/dataVersion';
import type {SyncSession} from '../sync/session';
import {rowNamed} from './queries';

/** A captured unbound account is distinct from an unavailable capture. */
export interface TagRenameIdentity {
  readonly accountId: string | undefined;
  /** None held yet: first version adoption keeps local rows and their queue. */
  readonly version: number | undefined;
}

/** Capture at Save; renameTag revalidates this inside its write transaction. */
export async function captureTagRenameIdentity({
  db,
  owner,
}: SyncSession): Promise<TagRenameIdentity> {
  return db.transaction('r', db.cursors, async () => ({
    accountId: await boundAccount(db, owner),
    version: await heldVersion(db, owner),
  }));
}

const belongsToAccount = (tag: Tag, account: string | undefined) =>
  tag.relationships.user.data.id === '' ||
  tag.relationships.user.data.id === account;

/** A rename may follow its stored row, never a replacement account or write. */
export async function isCurrentTagRename(
  session: SyncSession,
  renamed: Tag,
  identity: TagRenameIdentity | undefined
): Promise<boolean> {
  const {db, owner} = session;
  if (identity === undefined || db.hasBeenClosed()) return false;
  try {
    return await db.transaction('r', [db.tags, db.cursors], async () => {
      const account = await boundAccount(db, owner);
      const version = await heldVersion(db, owner);
      const current = await rowNamed(db.tags, owner, renamed.id);
      return (
        account === identity.accountId &&
        (identity.version === undefined || identity.version === version) &&
        current !== undefined &&
        belongsToAccount(renamed, account) &&
        belongsToAccount(current, account) &&
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
