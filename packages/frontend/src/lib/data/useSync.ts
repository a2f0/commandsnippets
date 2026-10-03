/**
 * When the data the page shows syncs (`lib/sync/`; the signed-in user's own,
 * or another user's for staff), the writes queued for it sent first: the
 * whole collection when the entries page opens, and again when it comes back
 * into view or online and every half minute while in view; and the tag
 * shown, whenever it is not
 * synced through the revision the database holds (on a first sign-in, before
 * the collection is whole; when a sync brings it a newer revision; and
 * every half minute, after a sync of it failed).
 */
import type {Tag} from '@commandsnippets/api-shared/responses';
import {useEffect, useState} from 'react';
import {leaveForeignSession} from '../state/appState';
import type {SyncSession} from '../sync/session';
import {ForeignDataError} from '../sync/store';
import {isTagSynced, SyncUserError} from '../sync/sync';
import {useSession} from './hooks';
import {flushFailed} from './writes';

export const SYNC_INTERVAL_MS = 30_000;

/**
 * A sync that failed: logged, and when the API answers for another user
 * than the signed-in one's own data (another tab signed in as someone
 * else), this tab leaves the session (`leaveForeignSession`).
 */
function syncFailed(session: SyncSession, error: unknown): void {
  if (
    !session.readOnly &&
    (error instanceof SyncUserError || error instanceof ForeignDataError)
  ) {
    console.error('ERROR: the API answers for another user:', error);
    void leaveForeignSession(session.username);
    return;
  }
  console.error('ERROR: sync failed:', error);
}

/**
 * Send the queued writes, then sync the collection: now, on coming into view
 * or back online, and every half minute.
 */
export function useCollectionSync(): {failed: boolean; retry: () => void} {
  const session = useSession();
  const [failedSession, setFailedSession] = useState<SyncSession | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (session === null) {
      return undefined;
    }
    let startedAt = 0;
    let running = false;
    let stopped = false;
    const run = () => {
      if (running) {
        return;
      }
      running = true;
      setFailedSession(null);
      startedAt = Date.now();
      session.sync
        .flush()
        .catch((error: unknown) => flushFailed(session, error))
        .then(() => session.sync.syncAll())
        .catch((error: unknown) => {
          syncFailed(session, error);
          if (!stopped) {
            setFailedSession(session);
          }
        })
        .finally(() => {
          running = false;
        });
    };
    const inView = () => document.visibilityState === 'visible';
    const onVisibility = () => {
      if (inView() && Date.now() - startedAt >= SYNC_INTERVAL_MS) {
        run();
      }
    };
    run();
    document.addEventListener('visibilitychange', onVisibility);
    // Back online: what was queued meanwhile goes now.
    window.addEventListener('online', run);
    const timer = setInterval(() => {
      if (inView()) {
        run();
      }
    }, SYNC_INTERVAL_MS);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', run);
      clearInterval(timer);
    };
  }, [session, attempt]);
  return {
    failed: session !== null && failedSession === session,
    retry: () => setAttempt(value => value + 1),
  };
}

/**
 * Sync `tag` whenever it is not synced through its stored revision: when it
 * is shown or gets a newer one, and every half minute while in view (after
 * a sync that failed).
 */
export function useTagSync(tag: Tag | null | undefined): void {
  const session = useSession();
  const tagId = tag?.id;
  const revision = tag?.attributes.date_updated;
  useEffect(() => {
    if (session === null || tagId === undefined || revision === undefined) {
      return undefined;
    }
    let running = false;
    const run = () => {
      if (running) {
        return;
      }
      running = true;
      isTagSynced(session.db, session.owner, tagId)
        .then(synced => (synced ? undefined : session.sync.syncTag(tagId)))
        .catch((error: unknown) => syncFailed(session, error))
        .finally(() => {
          running = false;
        });
    };
    run();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        run();
      }
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [session, tagId, revision]);
}
