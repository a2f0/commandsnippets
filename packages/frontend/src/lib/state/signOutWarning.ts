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

/**
 * How long a sign-out waits for the queue to be sent before warning (in
 * milliseconds; tests shorten it).
 */
export const signOutTiming = {flushWaitMs: 5000};

interface SignOutWarningState {
  /** The writes still unsent when the user asked to sign out (shown). */
  unsent: number | null;
  /** The user who asked: the warning is theirs only. */
  username: string | null;
}

const none = {unsent: null, username: null};

export const useSignOutWarning = create<SignOutWarningState>(() => none);

// Another account (or none) signed in meanwhile: the warning was the last
// one's, and goes.
useAppState.subscribe((state, previous) => {
  if (state.loggedInUser !== previous.loggedInUser) {
    useSignOutWarning.setState(none);
  }
});

// The sign-out the user asked for, while it decides: asking again (another
// click) joins it, never warning a second time after a Cancel.
let requested: Promise<void> | null = null;

/**
 * The user asked to sign out: send the queue (waiting
 * `signOutTiming.flushWaitMs` at most), then sign out, or warn when writes
 * are still unsent. When the queue cannot be read, they are signed out all
 * the same, any queued writes kept on this device (`endSyncSession`).
 */
export function requestSignOut(): Promise<void> {
  requested ??= decideSignOut().finally(() => {
    requested = null;
  });
  return requested;
}

async function decideSignOut(): Promise<void> {
  const username = useAppState.getState().loggedInUser;
  if (username === null) {
    return;
  }
  let unsent = 0;
  try {
    const {db, sync} = syncSession(username);
    await Promise.race([
      sync.flush().catch(() => undefined),
      new Promise(resolve => setTimeout(resolve, signOutTiming.flushWaitMs)),
    ]);
    unsent = await queuedCount(db, username);
  } catch (error: unknown) {
    console.error('ERROR: could not read the queued writes:', error);
  }
  // Signed out, or in as another, meanwhile: nothing to do.
  if (useAppState.getState().loggedInUser !== username) {
    return;
  }
  if (unsent === 0) {
    await signOut();
    return;
  }
  useSignOutWarning.setState({unsent, username});
}

/** Stay signed in, the writes queued. */
export function cancelSignOut(): void {
  useSignOutWarning.setState(none);
}

/**
 * Sign out after the warning: keeping the unsent writes on this device, or
 * discarding them. Only as the user it warned (a warning left from another
 * account does nothing).
 */
export async function confirmSignOut({
  discardQueued,
}: {
  discardQueued: boolean;
}): Promise<void> {
  const {username} = useSignOutWarning.getState();
  useSignOutWarning.setState(none);
  if (username === null || useAppState.getState().loggedInUser !== username) {
    return;
  }
  await signOut({discardQueued});
}
