import type {AnalyticsParams} from '@commandsnippets/api-shared/requests';
import {apiClient} from '../api/apiClient';
import {DataVersionChangedError} from '../api/errors';
import {assertHeld, heldVersion} from '../sync/dataVersion';
import {assertBound, boundAccount} from '../sync/outbox';
import type {SyncSession} from '../sync/session';

/** Include queued writes and refuse answers from another account or version. */
export async function readAnalytics(
  session: SyncSession,
  params: AnalyticsParams,
  signal: AbortSignal
) {
  const {db, owner, sync} = session;
  if (session.readOnly) throw new Error('Analytics are private');
  await sync.flush();
  signal.throwIfAborted();
  const account = await boundAccount(db, owner);
  const version = await heldVersion(db, owner);
  if (account === undefined || version === undefined)
    throw new Error('Analytics require synced data');
  try {
    const document = await apiClient
      .writesAs(owner)
      .forAccount(account)
      .forVersion(version)
      .getAnalytics(params, signal);
    await assertBound(db, owner, account);
    await assertHeld(db, owner, version);
    if (document.data.version !== version)
      throw new DataVersionChangedError('Analytics');
    return document.data;
  } catch (error) {
    if (error instanceof DataVersionChangedError && !signal.aborted)
      await sync
        .syncAll()
        .catch((syncError: unknown) =>
          console.warn('WARNING: analytics version sync failed:', syncError)
        );
    throw error;
  }
}
