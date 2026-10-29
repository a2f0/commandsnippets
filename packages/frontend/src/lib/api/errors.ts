/**
 * The errors the user and staff API clients raise (`apiClient`,
 * `adminApi`), kept apart from the clients so the sync (`lib/sync/`) can
 * tell them apart without importing a client (which imports the sync's
 * reads).
 */
import {CODES} from '@commandsnippets/api-shared/messages';

/**
 * A request the API answered with an error status (`${failure}:
 * ${statusText}`), which says whether trying it again can help: a queued
 * write (`lib/sync/outbox.ts`) is retried after a network failure or a 5xx,
 * and dropped after a 4xx. `detail` is the first error's, when the answer
 * was an error document (`errorDocument.ts`): why a backup was refused, say.
 */
export class ApiRequestError extends Error {
  constructor(
    failure: string,
    readonly status: number,
    statusText: string,
    readonly detail?: string
  ) {
    super(`${failure}: ${statusText}`);
    this.name = 'ApiRequestError';
  }
}

/**
 * A write the API refused because the request is signed in as another user
 * than the one it named (`EXPECTED_USER_HEADER`): another tab has signed in
 * as someone else since this one did.
 */
export class UserMismatchError extends Error {
  constructor(
    failure: string,
    readonly username: string
  ) {
    super(`${failure}: the session is not ${username}'s`);
    this.name = 'UserMismatchError';
  }
}

/**
 * A request the API refused because the data version it named
 * (`DATA_VERSION_HEADER`) is no longer the user's active one (409
 * `data_version_changed`): a backup was restored, or another version made
 * active, since this copy of the data was read. The copy is cleared and
 * synced again (`lib/sync/dataVersion.ts`).
 */
export class DataVersionChangedError extends Error {
  constructor(failure: string) {
    super(`${failure}: the data version changed`);
    this.name = 'DataVersionChangedError';
  }
}

/**
 * Throws what a refused request's first error `code` means to every client
 * (`apiClient`, `adminApi`), both 409s: `UserMismatchError` when the request
 * named `user` but is signed in as someone else, `DataVersionChangedError`
 * when the data version it named is no longer active. Any other answer is
 * the client's to raise.
 */
export function throwConflict(
  failure: string,
  status: number,
  code: string | undefined,
  user: string | null
): void {
  if (status !== 409) {
    return;
  }
  if (user !== null && code === CODES.userMismatch) {
    throw new UserMismatchError(failure, user);
  }
  if (code === CODES.dataVersionChanged) {
    throw new DataVersionChangedError(failure);
  }
}
