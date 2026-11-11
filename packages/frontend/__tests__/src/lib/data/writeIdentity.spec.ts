import {locks} from 'node:worker_threads';
import {
  createEntry,
  createTag,
  renameTag,
  reuseEntry,
  updateEntry,
} from '../../../../src/lib/data/writes';
import {boundAccount} from '../../../../src/lib/sync/accountBinding';
import {adoptVersion, heldVersion} from '../../../../src/lib/sync/dataVersion';
import {
  claimData,
  endSyncSession,
  type SyncSession,
  sessionsEndedCount,
  syncSession,
  withDataLock,
} from '../../../../src/lib/sync/session';
import {signIn, TEST_USER} from '../../../util/signIn';
import {entry, own, tag} from '../../../util/storeFixtures';

const originalAccount = 'account-a';
const replacementAccount = 'account-b';
const originalId = '1001';
const replacementId = '2002';
const draft = 'private draft from a';
const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');

afterEach(() => {
  if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks);
  else Reflect.deleteProperty(navigator, 'locks');
});

async function putRows(session: SyncSession, id: string, account: string) {
  const user = {data: {type: 'User' as const, id: account}};
  const savedEntry = entry(id, {body: `saved ${account}`});
  const savedTag = tag(id, {name: `saved ${account}`});
  await session.db.entries.put(
    own({...savedEntry, relationships: {...savedEntry.relationships, user}})
  );
  await session.db.tags.put(
    own({...savedTag, relationships: {...savedTag.relationships, user}})
  );
}

async function prepare(version: number | null = 1) {
  signIn();
  Object.defineProperty(navigator, 'locks', {configurable: true, value: locks});
  await claimData(TEST_USER, originalAccount);
  const session = syncSession(TEST_USER);
  vi.spyOn(session.sync, 'flush').mockResolvedValue(undefined);
  if (version !== null) await adoptVersion(session.db, TEST_USER, version);
  await putRows(session, originalId, originalAccount);
  return session;
}

// The lifecycle lock is already granted, but its callback has not run yet.
// The write starts against A and really queues behind that lock before B is
// installed. No exported write is mocked or invoked afresh after replacement.
async function duringClaim(
  session: SyncSession,
  account: string,
  id: string,
  startWrite: () => Promise<unknown>,
  version = account === originalAccount ? 1 : 2
) {
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const requested = Promise.withResolvers<void>();
  const generation = sessionsEndedCount();
  let intercepted = false;
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: (
        name: string,
        options: {mode: 'shared' | 'exclusive'},
        task: () => Promise<unknown>
      ) => {
        const pending = locks.request(name, options, async () => {
          if (options.mode === 'exclusive' && !intercepted) {
            intercepted = true;
            entered.resolve();
            await resume.promise;
            const result = await task();
            await adoptVersion(session.db, TEST_USER, version);
            await putRows(session, id, account);
            return result;
          }
          return task();
        });
        if (options.mode === 'shared') requested.resolve();
        return pending;
      },
    },
  });
  const claiming = claimData(TEST_USER, account);
  await entered.promise;
  let settled = false;
  const writing = startWrite().then(
    value => {
      settled = true;
      return {status: 'fulfilled' as const, value};
    },
    error => {
      settled = true;
      return {status: 'rejected' as const, error};
    }
  );
  try {
    await Promise.race([
      requested.promise,
      writing.then(outcome => {
        if (outcome.status === 'rejected') throw outcome.error;
        throw new Error('Write finished without requesting its shared lock');
      }),
    ]);
    const lockName = `commandsnippets-data:${session.db.name}`;
    const state = await locks.query();
    expect(
      state.held?.filter(lock => lock.name === lockName).map(lock => lock.mode)
    ).toEqual(['exclusive']);
    expect(
      state.pending
        ?.filter(lock => lock.name === lockName)
        .map(lock => lock.mode)
    ).toEqual(['shared']);
    expect(settled).toBe(false);
    expect(await boundAccount(session.db, TEST_USER)).toBe(originalAccount);
  } finally {
    resume.resolve();
    await claiming;
  }
  const outcome = await writing;
  expect(session).toBe(syncSession(TEST_USER));
  expect(sessionsEndedCount()).toBe(generation);
  return outcome;
}

it('keeps a pending create through a same-account claim', async () => {
  const session = await prepare();
  await duringClaim(session, originalAccount, originalId, () =>
    createEntry(session, 'draft', draft)
  );
  expect(
    (await session.db.entries.toArray()).filter(
      row => row.attributes.body === draft
    )
  ).toHaveLength(1);
  expect(
    (await session.db.outbox.toArray()).map(row => [
      row.write.kind,
      row.version,
    ])
  ).toEqual([['createEntry', 1]]);
});

it.each([
  ['entry', (session: SyncSession) => createEntry(session, 'draft', draft)],
  ['tag', (session: SyncSession) => createTag(session, draft)],
] as const)(
  'refuses a pending %s create after account replacement without an ID collision',
  async (_name, write) => {
    const session = await prepare();
    await duringClaim(session, replacementAccount, replacementId, () =>
      write(session)
    );
    expect(
      (await session.db.entries.toArray()).map(row => row.attributes.body)
    ).toEqual([`saved ${replacementAccount}`]);
    expect(
      (await session.db.tags.toArray()).map(row => row.attributes.name)
    ).toEqual([`saved ${replacementAccount}`]);
    expect(await session.db.outbox.toArray()).toEqual([]);
  }
);

it('refuses an old draft after a known-version replacement', async () => {
  const session = await prepare();
  await duringClaim(
    session,
    originalAccount,
    replacementId,
    () => createEntry(session, 'draft', draft),
    2
  );
  expect(await heldVersion(session.db, TEST_USER)).toBe(2);
  expect(
    (await session.db.entries.toArray()).map(row => row.attributes.body)
  ).toEqual([`saved ${originalAccount}`]);
  expect(await session.db.outbox.toArray()).toEqual([]);
});

it.each([
  [
    'update',
    (session: SyncSession) => updateEntry(session, originalId, 'draft', draft),
  ],
  ['rename', (session: SyncSession) => renameTag(session, originalId, draft)],
  ['reuse', (session: SyncSession) => reuseEntry(session, originalId)],
] as const)(
  'refuses a pending %s of a deliberately reused replacement ID',
  async (_name, write) => {
    const session = await prepare();
    await duringClaim(session, replacementAccount, originalId, () =>
      write(session)
    );
    expect(
      (await session.db.entries.toArray()).map(row => [
        row.attributes.body,
        row.attributes.reused_count,
      ])
    ).toEqual([[`saved ${replacementAccount}`, 0]]);
    expect(
      (await session.db.tags.toArray()).map(row => row.attributes.name)
    ).toEqual([`saved ${replacementAccount}`]);
    expect(await session.db.outbox.toArray()).toEqual([]);
  }
);

it('does not update a distinct replacement server ID', async () => {
  const session = await prepare();
  await duringClaim(session, replacementAccount, replacementId, () =>
    updateEntry(session, originalId, 'draft', draft)
  );
  expect(
    (await session.db.entries.toArray()).map(row => row.attributes.body)
  ).toEqual([`saved ${replacementAccount}`]);
  expect(await session.db.outbox.toArray()).toEqual([]);
});

it('permits first version adoption for never-synced local data', async () => {
  const session = await prepare(null);
  expect(await heldVersion(session.db, TEST_USER)).toBeUndefined();
  await duringClaim(
    session,
    originalAccount,
    originalId,
    () => createEntry(session, 'draft', draft),
    2
  );
  expect(
    (await session.db.entries.toArray()).some(
      row => row.attributes.body === draft
    )
  ).toBe(true);
  expect((await session.db.outbox.toArray()).map(row => row.version)).toEqual([
    2,
  ]);
});

it('a closing session rejects a pending create without adopting its replacement', async () => {
  const session = await prepare();
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const holding = withDataLock(session.db.name, 'exclusive', async () => {
    entered.resolve();
    await resume.promise;
  });
  await entered.promise;
  const writing = createEntry(session, 'draft', draft).then(
    () => 'written',
    error => error.name
  );
  try {
    await vi.waitFor(async () =>
      expect(
        (await locks.query()).pending?.some(lock => lock.mode === 'shared')
      ).toBe(true)
    );
  } finally {
    resume.resolve();
  }
  // Close synchronously before the queued native lock callback can execute.
  const ending = endSyncSession(TEST_USER);
  expect(session.db.hasBeenClosed()).toBe(true);
  await holding;
  expect(await writing).toBe('DatabaseClosedError');
  await ending;
});
