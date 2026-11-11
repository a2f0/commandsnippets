import {assertBound, boundAccount} from '../sync/accountBinding';
import {assertHeld, heldVersion} from '../sync/dataVersion';
import type {SyncSession} from '../sync/session';

/**
 * An unbound account is distinct from a failed capture, not a wildcard.
 * OAuth claims the account before publishing sign-in. If a binding changes
 * during a write, retry from a fresh capture rather than guessing its owner.
 */
export interface WriteIdentity {
  readonly accountId: string | undefined;
  /** First version adoption preserves never-synced local rows and writes. */
  readonly version: number | undefined;
}

/** Capture before any wait that can replace the operation's account/data. */
export function captureWriteIdentity({
  db,
  owner,
}: SyncSession): Promise<WriteIdentity> {
  return db.transaction('r', db.cursors, async () => ({
    accountId: await boundAccount(db, owner),
    version: await heldVersion(db, owner),
  }));
}

/** Call inside the write transaction, including cursors, before any mutation. */
export async function assertWriteIdentity(
  {db, owner}: SyncSession,
  identity: WriteIdentity
): Promise<void> {
  await assertBound(db, owner, identity.accountId);
  await assertHeld(db, owner, identity.version);
}
