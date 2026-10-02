/**
 * Signing out with writes not sent yet: the queue is sent first, if it can
 * be; when writes are still unsent, the user is warned (`SignOutWarning`)
 * and chooses to stay, to sign out keeping them on this device (sent at
 * their next sign-in here), or to discard them.
 */
import {create} from 'zustand';
import {queuedCount} from '../sync/outbox';
import {syncSession} from '../sync/session';
import {signOut, useAppState} from './appState';

/** How long a sign-out waits for the queue to be sent before warning. */
export const FLUSH_WAIT_MS = 5000;

interface SignOutWarningState {
  /** The writes still unsent when the user asked to sign out (shown). */
  unsent: number | null;
}

export const useSignOutWarning = create<SignOutWarningState>(() => ({
  unsent: null,
}));

/**
 * The user asked to sign out: send the queue (waiting `FLUSH_WAIT_MS` at
 * most), then sign out, or warn when writes are still unsent.
 */
export async function requestSignOut(): Promise<void> {
  const username = useAppState.getState().loggedInUser;
  if (username === null) {
    return;
  }
  const {db, sync} = syncSession(username);
  await Promise.race([
    sync.flush().catch(() => undefined),
    new Promise(resolve => setTimeout(resolve, FLUSH_WAIT_MS)),
  ]);
  const unsent = await queuedCount(db, username);
  if (unsent === 0) {
    await signOut();
    return;
  }
  useSignOutWarning.setState({unsent});
}

/** Stay signed in, the writes queued. */
export function cancelSignOut(): void {
  useSignOutWarning.setState({unsent: null});
}

/**
 * Sign out after the warning: keeping the unsent writes on this device, or
 * discarding them.
 */
export async function confirmSignOut({
  discardQueued,
}: {
  discardQueued: boolean;
}): Promise<void> {
  useSignOutWarning.setState({unsent: null});
  await signOut({discardQueued});
}
