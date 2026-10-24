import type {SyncSession} from '../sync/session';
import {reuseEntry} from './writes';

/**
 * Copy `text` (entry `entryId`'s body, or a selection of it) to the
 * clipboard, and once it is copied count a reuse of the entry: every copy
 * is one (the copy icon, a click on the body, the menu's Copy, Enter in the
 * list). Its owner's only: a read-only page (staff's, the public's) counts
 * nothing.
 */
export function copyEntry(
  session: SyncSession | null,
  entryId: string,
  text: string
): void {
  void navigator.clipboard
    .writeText(text)
    .then(() =>
      session === null || session.readOnly
        ? undefined
        : reuseEntry(session, entryId)
    )
    .catch((error: unknown) =>
      console.error('Failed to copy the entry or count it:', error)
    );
}
