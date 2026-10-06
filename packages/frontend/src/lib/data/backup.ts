/**
 * Exporting the signed-in user's data (File > Export Backup): the API's
 * backup of it (api-shared's `backupSchema`: every tag, entry, tagging and
 * reuse not deleted, with the id the API knows it by), saved as a file. The
 * writes queued here are sent first, so the backup holds them.
 */
import type {Backup} from '@commandsnippets/api-shared/responses';
import {apiClient} from '../api/apiClient';
import {syncSession} from '../sync/session';

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
 * Throws when the queue cannot be sent (offline, say: the backup would miss
 * those writes) or the backup cannot be read, saving nothing; and
 * `UserMismatchError` when this tab is no longer signed in as `username`.
 */
export async function exportBackup(username: string): Promise<void> {
  await syncSession(username).sync.flush();
  const backup = await apiClient.writesAs(username).getBackup();
  saveFile(
    backupFileName(backup),
    `${JSON.stringify(backup, null, 2)}\n`,
    'application/json'
  );
}
