import {DataVersionChangedError} from '../api/errors';
import {signedInUser} from '../auth/authUtils';
import {AccountChangedError} from '../sync/accountBinding';
import {type SyncSession, sessionsEndedCount} from '../sync/session';
import {
  assertWriteIdentity,
  captureWriteIdentity,
  type WriteIdentity,
} from './writeIdentity';
import {reuseEntry} from './writes';

// Shared by row, keyboard and detail-page copies: a late completion must not
// replace feedback for a newer success. A failed request supersedes nothing.
// Successful copies still count against their captured data, never replacement
// data, even when their view or newer-success feedback has moved on.
let nextCopy = 0;
let newestSuccessfulCopy = 0;

async function captureCopyIdentity(session: SyncSession) {
  try {
    return {
      status: 'captured' as const,
      identity: await captureWriteIdentity(session),
    };
  } catch (error) {
    // Handle rejection immediately even if the clipboard later fails first.
    return {status: 'failed' as const, error};
  }
}

async function isCurrentCopy(session: SyncSession, identity: WriteIdentity) {
  try {
    await session.db.transaction('r', session.db.cursors, async () => {
      await assertWriteIdentity(session, identity);
    });
    return true;
  } catch (error) {
    if (
      !(error instanceof AccountChangedError) &&
      !(error instanceof DataVersionChangedError) &&
      !session.db.hasBeenClosed()
    ) {
      console.error('Failed to verify the entry copy:', error);
    }
    return false;
  }
}

/**
 * Copy `text` (entry `entryId`'s body, or a selection of it) to the
 * clipboard, and once it is copied count a reuse of the entry: every copy
 * is one (the copy icon, a click on the body, the menu's Copy, Enter in the
 * list). Its owner's only: a read-only page (staff's, the public's) counts
 * nothing. Returns true only if this is still the newest successful copy in
 * the same account. Writable copies also verify their captured data identity;
 * counting or refusing feedback cannot undo the clipboard write itself.
 */
export async function copyEntry(
  session: SyncSession | null,
  entryId: string,
  text: string
): Promise<boolean> {
  const request = ++nextCopy;
  const account = signedInUser();
  const generation = sessionsEndedCount();
  // Start capture now, but never await storage before gesture-sensitive copy.
  // Read-only copies mutate no data, so they do not depend on storage at all.
  const capturing =
    session === null || session.readOnly ? null : captureCopyIdentity(session);
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error('Failed to copy the entry:', error);
    return false;
  }
  const captured = await capturing;
  if (session !== null && captured !== null) {
    if (captured.status === 'failed') {
      console.error(
        'Failed to capture the entry copy identity:',
        captured.error
      );
      return false;
    }
    void reuseEntry(session, entryId, captured.identity).catch(
      (error: unknown) =>
        console.error('Failed to count the entry copy:', error)
    );
    if (!(await isCurrentCopy(session, captured.identity))) return false;
  }
  if (
    request < newestSuccessfulCopy ||
    account !== signedInUser() ||
    generation !== sessionsEndedCount()
  ) {
    return false;
  }
  newestSuccessfulCopy = request;
  return true;
}
