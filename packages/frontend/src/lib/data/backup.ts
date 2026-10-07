/**
 * Backups and data versions of the signed-in user's data. A backup
 * (api-shared's `backupSchema`) is every tag, entry, tagging and reuse not
 * deleted in one data version, with the ids the API knows them by.
 *
 * - File > Export Backup saves the API's backup of the active version (or,
 *   from Data Versions, of another) as a file.
 * - File > Restore Backup makes a backup file's data (any account's) the
 *   user's, as a new data version made active; the version before is kept.
 * - File > Data Versions lists the versions, makes one active, exports one,
 *   or deletes one not active.
 *
 * Each sends the writes queued here first, to the version they were made
 * against, and acts as the account the data is bound to. Making another
 * version active (a restore, or a switch) holds this copy of the data at it
 * (`adoptVersion`: the rows of the one before go) and syncs it again.
 */
import {
  type Backup,
  backupSchema,
  type DataVersion,
  type RestoreResult,
} from '@commandsnippets/api-shared/responses';
import {apiClient} from '../api/apiClient';
import {describeIssues} from '../api/parseResponse';
import {adoptVersion, heldVersion} from '../sync/dataVersion';
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

/**
 * The backup's file name: whose it is, the day (UTC) it was made, and the
 * data version it is of when one was named.
 */
export function backupFileName(backup: Backup, version?: number): string {
  const day = backup.date_exported.slice(0, 10);
  const of = version === undefined ? '' : `-v${version}`;
  return `commandsnippets-backup-${backup.user.username}-${day}${of}.json`;
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
 * Send `username`'s queued writes, then save the API's backup of their data:
 * of the active version, or of `version`. Throws when the queue cannot be
 * sent (the backup would miss those writes) or the backup cannot be read,
 * saving nothing.
 */
export async function exportBackup(
  username: string,
  version?: number
): Promise<void> {
  const failure = 'Failed to export backup';
  const {api, accountId} = await flushedAccount(username, failure);
  const backup = await api.getBackup(version);
  if (backup.user.id !== accountId || backup.user.username !== username) {
    throw new BackupAccountError(failure, username);
  }
  saveFile(
    backupFileName(backup, version),
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
 * holds them: what a restore replaces.
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
 * The account `username`'s data is bound to (`flushedAccount`, which sends
 * their queued writes and binds it): the one a restore is to make the data
 * of, whose data the user is warned about.
 */
export async function restoreAccount(username: string): Promise<string> {
  const {accountId} = await flushedAccount(
    username,
    'Failed to restore backup'
  );
  return accountId;
}

/**
 * Hold `username`'s data here at the active data version `version`, and
 * sync it. A sync that fails now is the page's to retry.
 */
async function adopt(
  username: string,
  sync: SyncEngine,
  version: number
): Promise<void> {
  await adoptVersion(syncSession(username).db, username, version);
  await sync.syncAll().catch((error: unknown) => {
    console.warn('WARNING: sync after a data version switch failed:', error);
  });
}

/**
 * Make `backup`'s data that of account `accountId` (`username`'s), as a new
 * data version made active (`POST /user/restore`): as that account, and
 * over the version this copy of the data is of (the one the user was
 * warned about), so refused (`UserMismatchError`, `DataVersionChangedError`)
 * when the data here is bound to another account since, or another version
 * is active. Then this copy is held at the new version, and synced. Throws
 * when the queue cannot be sent or the restore fails (`ApiRequestError`,
 * with the API's `detail` when it refused the backup).
 */
export async function restoreBackup(
  username: string,
  accountId: string,
  backup: Backup
): Promise<RestoreResult> {
  const failure = 'Failed to restore backup';
  const {db} = syncSession(username);
  const bound = await flushedAccount(username, failure);
  // Only into the account the user was warned about.
  if (bound.accountId !== accountId) {
    throw new BackupAccountError(failure, username);
  }
  const held = await heldVersion(db, username);
  const api = held === undefined ? bound.api : bound.api.forVersion(held);
  const result = await api.restoreBackup(backup);
  await adopt(username, bound.sync, result.data_version);
  return result;
}

/** `username`'s data versions, newest first, as their account. */
export async function listVersions(username: string): Promise<DataVersion[]> {
  const accountId = await boundAccount(syncSession(username).db, username);
  const api = apiClient.writesAs(username);
  const {data} = await (accountId === undefined
    ? api
    : api.forAccount(accountId)
  ).getDataVersions();
  return data;
}

/**
 * Make data version `version` `username`'s active one, after sending the
 * writes queued here (to the version they were made against), then hold
 * this copy of the data at it, and sync it.
 */
export async function activateVersion(
  username: string,
  version: number
): Promise<void> {
  const {api, sync} = await flushedAccount(
    username,
    'Failed to switch data versions'
  );
  await api.activateDataVersion(version);
  await adopt(username, sync, version);
}

/** Delete `username`'s data version `version` (one not active). */
export async function deleteVersion(
  username: string,
  version: number
): Promise<void> {
  const {api} = await flushedAccount(username, 'Failed to delete data version');
  await api.deleteDataVersion(version);
}
