/**
 * Backups of the signed-in user's data (api-shared's `backupSchema`: every
 * tag, entry, tagging and reuse not deleted, with the id the API knows it
 * by). File > Export Backup saves the API's backup as a file; File > Restore
 * Backup replaces all of the user's data with a backup file's, any
 * account's. Either way the writes queued here are sent first: a backup then
 * holds them, and a restore is not changed by them afterwards.
 */
import {
  type Backup,
  backupSchema,
  type RestoreResult,
} from '@commandsnippets/api-shared/responses';
import {apiClient} from '../api/apiClient';
import {describeIssues} from '../api/parseResponse';
import {syncSession} from '../sync/session';
import {boundAccount, type SyncEngine} from '../sync/sync';

/**
 * No account to act as (the data is bound to none), or a backup the API
 * answered with for another account than the one this tab's data is bound
 * to: never saved as this user's.
 */
export class BackupAccountError extends Error {
  constructor(failure: string, username: string) {
    super(`${failure}: not ${username}'s account`);
    this.name = 'BackupAccountError';
  }
}

/** A file that is not a backup this app can restore. */
export class BackupFileError extends Error {
  constructor(reason: string) {
    super(`Not a backup: ${reason}`);
    this.name = 'BackupFileError';
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
 * Send `username`'s queued writes, then the API client of the account their
 * data is bound to (the flush binds it), as the queue's writes are: its
 * requests are refused (`UserMismatchError`) when this tab is no longer
 * signed in as that account, though another of the same username (the first
 * deleted, its name taken again) is. Throws when the queue cannot be sent
 * (offline, say).
 */
async function flushedAccount(
  username: string,
  failure: string
): Promise<{api: typeof apiClient; accountId: string; sync: SyncEngine}> {
  const {db, sync} = syncSession(username);
  await sync.flush();
  const accountId = await boundAccount(db, username);
  if (accountId === undefined) {
    throw new BackupAccountError(failure, username);
  }
  return {
    api: apiClient.writesAs(username).forAccount(accountId),
    accountId,
    sync,
  };
}

/**
 * Send `username`'s queued writes, then save the API's backup of their data
 * (asked for as their account, `flushedAccount`). Throws when the queue
 * cannot be sent (the backup would miss those writes) or the backup cannot
 * be read, saving nothing.
 */
export async function exportBackup(username: string): Promise<void> {
  const failure = 'Failed to export backup';
  const {api, accountId} = await flushedAccount(username, failure);
  const backup = await api.getBackup();
  if (backup.user.id !== accountId || backup.user.username !== username) {
    throw new BackupAccountError(failure, username);
  }
  saveFile(
    backupFileName(backup),
    `${JSON.stringify(backup, null, 2)}\n`,
    'application/json'
  );
}

/** The backup a file's text holds, or `BackupFileError`. */
export function readBackupFile(text: string): Backup {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new BackupFileError('not JSON');
  }
  const result = backupSchema.safeParse(body);
  if (!result.success) {
    throw new BackupFileError(describeIssues(result.error.issues));
  }
  return result.data;
}

/**
 * How many tags and entries (not deleted) `username` has, as this device
 * holds them: what a restore deletes.
 */
export async function liveCounts(
  username: string
): Promise<{tags: number; entries: number}> {
  const {db} = syncSession(username);
  const [tags, entries] = await Promise.all([
    db.tags
      .where('owner')
      .equals(username)
      .filter(row => !row.attributes.is_deleted)
      .count(),
    db.entries
      .where('owner')
      .equals(username)
      .filter(row => !row.attributes.is_deleted)
      .count(),
  ]);
  return {tags, entries};
}

/**
 * Replace all of `username`'s data with `backup`'s (`POST /user/restore`, as
 * their account, `flushedAccount`), then sync it here. Their queued writes
 * are sent first: sent after it, they would change the data restored.
 * Throws when they cannot be sent (restoring nothing) or the restore fails
 * (`ApiRequestError`, with the API's `detail` when it refused the backup).
 */
export async function restoreBackup(
  username: string,
  backup: Backup
): Promise<RestoreResult> {
  const {api, sync} = await flushedAccount(
    username,
    'Failed to restore backup'
  );
  const result = await api.restoreBackup(backup);
  // The restore is made: a sync that fails now is the page's to retry.
  await sync.syncAll().catch((error: unknown) => {
    console.warn('WARNING: sync after restore failed:', error);
  });
  return result;
}
