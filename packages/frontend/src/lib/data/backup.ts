/**
 * Exporting the signed-in user's data (File > Export Backup): the API's
 * backup of it (api-shared's `backupSchema`: every tag, entry, tagging and
 * reuse not deleted, with the id the API knows it by), saved as a file. The
 * writes queued here are sent first, so the backup holds them.
 */
import type {Backup} from '@commandsnippets/api-shared/responses';
import {apiClient} from '../api/apiClient';
import {syncSession} from '../sync/session';
import {boundAccount} from '../sync/sync';

/**
 * No account the backup can be asked for as (the data is bound to none), or
 * a backup the API answered with for another account than the one this
 * tab's data is bound to: never saved as this user's.
 */
export class BackupAccountError extends Error {
  constructor(username: string) {
    super(`Failed to export backup: not ${username}'s account`);
    this.name = 'BackupAccountError';
  }
}

/** The backup's file name: whose it is, and the day (UTC) it was made. */
export function backupFileName(backup: Backup): string {
  const day = backup.date_exported.slice(0, 10);
  return `commandsnippets-backup-${backup.user.username}-${day}.json`;
}

/** Offer `text` to the user as a file named `name` (a download). */
export function saveFile(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], {type}));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // Once the click has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Send `username`'s queued writes, then save the API's backup of their data.
 * The backup is asked for as the account the data is bound to (the flush
 * binds it), as the queue's writes are: refused (`UserMismatchError`) when
 * this tab is no longer signed in as that account, though another of the
 * same username (the first deleted, its name taken again) is. Throws when
 * the queue cannot be sent (offline, say: the backup would miss those
 * writes) or the backup cannot be read, saving nothing.
 */
export async function exportBackup(username: string): Promise<void> {
  const {db, sync} = syncSession(username);
  await sync.flush();
  const accountId = await boundAccount(db, username);
  if (accountId === undefined) {
    throw new BackupAccountError(username);
  }
  const backup = await apiClient
    .writesAs(username)
    .forAccount(accountId)
    .getBackup();
  if (backup.user.id !== accountId || backup.user.username !== username) {
    throw new BackupAccountError(username);
  }
  saveFile(
    backupFileName(backup),
    `${JSON.stringify(backup, null, 2)}\n`,
    'application/json'
  );
}
