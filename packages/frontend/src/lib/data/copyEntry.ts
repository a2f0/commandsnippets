import {signedInUser} from '../auth/authUtils';
import type {SyncSession} from '../sync/session';
import {reuseEntry} from './writes';

// Shared by row, keyboard and detail-page copies: a late completion must not
// replace feedback for a newer request. Every successful copy still counts.
let newestCopy = 0;

/**
 * Copy `text` (entry `entryId`'s body, or a selection of it) to the
 * clipboard, and once it is copied count a reuse of the entry: every copy
 * is one (the copy icon, a click on the body, the menu's Copy, Enter in the
 * list). Its owner's only: a read-only page (staff's, the public's) counts
 * nothing. Returns true only if this is still the newest copy in the same
 * account and its clipboard write succeeded; counting it cannot undo that.
 */
export async function copyEntry(
  session: SyncSession | null,
  entryId: string,
  text: string
): Promise<boolean> {
  const request = ++newestCopy;
  const account = signedInUser();
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error('Failed to copy the entry:', error);
    return false;
  }
  if (session !== null && !session.readOnly) {
    void reuseEntry(session, entryId).catch((error: unknown) =>
      console.error('Failed to count the entry copy:', error)
    );
  }
  return request === newestCopy && account === signedInUser();
}
