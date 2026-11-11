import {act} from '@testing-library/react';
import {vi} from 'vitest';
import {type SyncSession, syncSession} from '../../src/lib/sync/session';
import * as syncReads from '../../src/lib/sync/sync';
import {mockResult} from './mockResult';

/** Join work the mounted page starts, without starting another sync as a fence. */
export function observeSyncWork(userOrSession: string | SyncSession) {
  const engine =
    typeof userOrSession === 'string'
      ? syncSession(userOrSession).sync
      : userOrSession.sync;
  const syncAll = vi.spyOn(engine, 'syncAll');
  const observed = [
    syncAll,
    vi.spyOn(engine, 'flush'),
    vi.spyOn(engine, 'syncTag'),
    vi.spyOn(syncReads, 'isTagSynced'),
  ];
  const finish = async () => {
    const joined = new Set<Promise<unknown>>();
    for (;;) {
      const pending: Promise<unknown>[] = [];
      for (const operation of observed) {
        for (let index = 0; index < operation.mock.results.length; index++) {
          const promise = mockResult<Promise<unknown>>(operation, index);
          if (!joined.has(promise)) {
            joined.add(promise);
            pending.push(promise);
          }
        }
      }
      if (pending.length === 0) return;
      // A readiness result or flush can schedule another real sync.
      await act(async () => {
        await Promise.all(pending);
      });
    }
  };
  return {syncAll, finish};
}
