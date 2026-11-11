import {vi} from 'vitest';
import {copyEntry} from '../../../../src/lib/data/copyEntry';
import * as writes from '../../../../src/lib/data/writes';
import {adoptVersion} from '../../../../src/lib/sync/dataVersion';
import {
  claimData,
  endSyncSession,
  type SyncSession,
  syncSession,
} from '../../../../src/lib/sync/session';
import {mockResult} from '../../../util/mockResult';
import {signIn, store, TEST_USER} from '../../../util/signIn';
import {entry, own} from '../../../util/storeFixtures';

it('does not publish clipboard success into a different signed-in account', async () => {
  signIn();
  const pending = Promise.withResolvers<void>();
  Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: vi.fn().mockReturnValue(pending.promise)},
    configurable: true,
  });
  // Public copies have no session, but their feedback still belongs to the
  // account context in which they started.
  const result = copyEntry(null, '1', 'body');
  store.setLoggedInUser('replacement');
  pending.resolve();

  expect(await result).toBe(false);
});

async function seed(session: SyncSession, account: string) {
  const row = entry('1', {body: account, reused_count: 0});
  await session.db.entries.put(
    own({
      ...row,
      relationships: {
        ...row.relationships,
        user: {data: {type: 'User', id: account}},
      },
    })
  );
}

async function pendingCopy() {
  signIn();
  await claimData(TEST_USER, 'original');
  const session = syncSession(TEST_USER);
  vi.spyOn(session.sync, 'flush').mockResolvedValue(undefined);
  await adoptVersion(session.db, TEST_USER, 1);
  await seed(session, 'original');
  const pending = Promise.withResolvers<void>();
  const writeText = vi.fn().mockReturnValue(pending.promise);
  Object.defineProperty(navigator, 'clipboard', {
    value: {writeText},
    configurable: true,
  });
  const reuse = vi.spyOn(writes, 'reuseEntry');
  const copied = copyEntry(session, '1', 'original');
  // Keep writeText in the originating gesture, before any storage await.
  expect(writeText).toHaveBeenCalledExactlyOnceWith('original');
  // Drain any pre-copy metadata read before changing the binding/version.
  await session.db.transaction('rw', session.db.cursors, async () => {});
  return {session, pending, reuse, copied};
}

it.each(['account', 'version'] as const)(
  'does not count or publish a held copy into a replacement %s',
  async boundary => {
    const failed = vi.spyOn(console, 'error').mockImplementation(() => {});
    const {session, pending, reuse, copied} = await pendingCopy();
    const account = boundary === 'account' ? 'replacement' : 'original';
    if (boundary === 'account') await claimData(TEST_USER, account);
    await adoptVersion(session.db, TEST_USER, 2);
    // Deliberately reuse the ID to prove refusal, not an absent-row no-op.
    await seed(session, account);
    pending.resolve();
    const feedback = await copied;
    await vi.waitFor(() => expect(reuse).toHaveBeenCalledOnce());
    await mockResult(reuse).catch(() => undefined);
    expect(
      (await session.db.entries.get([TEST_USER, '1']))?.attributes.reused_count
    ).toBe(0);
    expect(await session.db.outbox.toArray()).toEqual([]);
    expect(feedback).toBe(false);
    expect(failed).toHaveBeenCalledExactlyOnceWith(
      'Failed to count the entry copy:',
      expect.objectContaining({
        name:
          boundary === 'account'
            ? 'AccountChangedError'
            : 'DataVersionChangedError',
      })
    );
  }
);

it('counts an eligible held copy without advancing its edit date', async () => {
  const {session, pending, reuse, copied} = await pendingCopy();
  const before = await session.db.entries.get([TEST_USER, '1']);
  pending.resolve();
  expect(await copied).toBe(true);
  await vi.waitFor(() => expect(reuse).toHaveBeenCalledOnce());
  await mockResult(reuse);
  const after = await session.db.entries.get([TEST_USER, '1']);
  expect(after?.attributes.reused_count).toBe(1);
  expect(after?.attributes.date_updated).toBe(before?.attributes.date_updated);
});

it('does not publish a held copy after the same username gets a new session', async () => {
  const failed = vi.spyOn(console, 'error').mockImplementation(() => {});
  const {session, pending, reuse, copied} = await pendingCopy();
  await endSyncSession(TEST_USER);
  expect(syncSession(TEST_USER)).not.toBe(session);
  pending.resolve();
  const feedback = await copied;
  await vi.waitFor(() => expect(reuse).toHaveBeenCalledOnce());
  await mockResult(reuse).catch(() => undefined);
  expect(feedback).toBe(false);
  expect(failed).toHaveBeenCalledExactlyOnceWith(
    'Failed to count the entry copy:',
    expect.objectContaining({name: 'DatabaseClosedError'})
  );
});
