/**
 * When the signed-in user's data syncs (`lib/sync/`): the whole collection
 * when the entries page opens, and again when it comes back into view and
 * every half minute while in view; and the tag shown, whenever it is not
 * synced through the revision the database holds (on a first sign-in, before
 * the collection is whole; and when a sync brings it a newer revision).
 */
import type {Tag} from '@commandsnippets/api-shared/responses';
import {useEffect} from 'react';
import {resetApplicationState} from '../state/appState';
import {ForeignDataError} from '../sync/store';
import {isTagSynced, SyncUserError} from '../sync/sync';
import {useSession} from './hooks';

export const SYNC_INTERVAL_MS = 30_000;

/**
 * A sync that failed: logged, and when the API answers for another user
 * (another tab signed in as someone else), signed out here too.
 */
function syncFailed(error: unknown): void {
  if (error instanceof SyncUserError || error instanceof ForeignDataError) {
    console.error('ERROR: the API answers for another user:', error);
    resetApplicationState();
    return;
  }
  console.error('ERROR: sync failed:', error);
}

/** Sync the collection now, on coming into view, and every half minute. */
export function useCollectionSync(): void {
  const session = useSession();
  useEffect(() => {
    if (session === null) {
      return undefined;
    }
    let startedAt = 0;
    let running = false;
    const run = () => {
      if (running) {
        return;
      }
      running = true;
      startedAt = Date.now();
      session.sync
        .syncAll()
        .catch(syncFailed)
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
    const timer = setInterval(() => {
      if (inView()) {
        run();
      }
    }, SYNC_INTERVAL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(timer);
    };
  }, [session]);
}

/** Sync `tag` whenever it is not synced through its stored revision. */
export function useTagSync(tag: Tag | null | undefined): void {
  const session = useSession();
  const tagId = tag?.id;
  const revision = tag?.attributes.date_updated;
  useEffect(() => {
    if (session === null || tagId === undefined || revision === undefined) {
      return;
    }
    isTagSynced(session.db, tagId)
      .then(synced => (synced ? undefined : session.sync.syncTag(tagId)))
      .catch(syncFailed);
  }, [session, tagId, revision]);
}
