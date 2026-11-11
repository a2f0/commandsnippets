import {act} from '@testing-library/react';
import {type MockResult, vi} from 'vitest';
import * as sessions from '../../src/lib/sync/session';
import * as syncReads from '../../src/lib/sync/sync';
import {mockResult} from './mockResult';

/** Scenario-owned reads, including the public view briefly mounted at sign-out. */
export function observeSignOutWork() {
  const observed: {mock: {results: readonly MockResult<Promise<unknown>>[]}}[] =
    [vi.spyOn(syncReads, 'isTagSynced')];
  const known = new Set<sessions.SyncSession>();
  const observe = (session: sessions.SyncSession) => {
    if (!known.has(session)) {
      known.add(session);
      observed.push(
        vi.spyOn(session.sync, 'flush'),
        vi.spyOn(session.sync, 'syncAll'),
        vi.spyOn(session.sync, 'syncTag')
      );
    }
    return session;
  };
  const own = sessions.syncSession;
  const publicSession = sessions.publicSyncSession;
  vi.spyOn(sessions, 'syncSession').mockImplementation((...args) =>
    observe(own(...args))
  );
  vi.spyOn(sessions, 'publicSyncSession').mockImplementation((...args) =>
    observe(publicSession(...args))
  );
  const joined = new Set<Promise<unknown>>();
  return {
    finish: async (expectedFailures: unknown[] = []) => {
      const failures: unknown[] = [];
      for (;;) {
        const pending = observed
          .flatMap(operation =>
            operation.mock.results.map((_, index) =>
              mockResult<Promise<unknown>>(operation, index)
            )
          )
          .filter(promise => !joined.has(promise));
        if (pending.length === 0) break;
        for (const promise of pending) joined.add(promise);
        await act(async () => {
          // The hooks handle these failures. Require the scenario to name each
          // interruption, and separately assert its original visible diagnostic.
          for (const result of await Promise.allSettled(pending)) {
            if (result.status === 'rejected') failures.push(result.reason);
          }
        });
      }
      expect(failures).toEqual(expectedFailures);
    },
  };
}
