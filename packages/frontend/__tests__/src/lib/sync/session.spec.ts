import {locks} from 'node:worker_threads';
import Dexie from 'dexie';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  CommandsnippetsDatabase,
  databaseName,
  OWNER_ID_KEY,
} from '../../../../src/lib/db/database';
import {
  claimData,
  endSyncSession,
  hasQueuedWrites,
  syncSession,
  withDataLock,
} from '../../../../src/lib/sync/session';

afterEach(() => {
  vi.unstubAllGlobals();
  return endSyncSession(null);
});

describe('syncSession', () => {
  it("opens the user's own database, one at a time", async () => {
    const alice = syncSession('alice');
    expect(syncSession('alice')).toBe(alice);
    expect(alice.db.name).toBe(databaseName('test', 'alice'));

    const bob = syncSession('bob');
    expect(bob.db.name).toBe(databaseName('test', 'bob'));
    expect(alice.db.isOpen()).toBe(false);
  });

  it("opens another user's data in the same database, read-only", () => {
    const own = syncSession('frank');
    const other = syncSession('frank', 'alice');

    expect(own).toMatchObject({username: 'frank', owner: 'frank'});
    expect(own.readOnly).toBe(false);
    expect(other).toMatchObject({username: 'frank', owner: 'alice'});
    expect(other.readOnly).toBe(true);
    expect(other.db).toBe(own.db);
    expect(other.sync).not.toBe(own.sync);
    expect(syncSession('frank', 'alice')).toBe(other);
    expect(syncSession('frank', 'frank')).toBe(own);
  });

  it("deletes the other users' data read with it when the session ends", async () => {
    const other = syncSession('gina', 'alice');
    await other.db.cursors.put({
      owner: 'alice',
      key: 'tags',
      after: '1970-01-01T00:00:00,0',
    });

    await endSyncSession('gina');
    expect(await Dexie.exists(other.db.name)).toBe(false);
  });

  it('keeps the data while writes are queued in it, unless told to discard them', async () => {
    const {db} = syncSession('hana');
    await db.outbox.add({
      owner: 'hana',
      made: '2026-01-01T00:00:00.000000',
      writeId: 'write-1',
      write: {kind: 'deleteTag', tagId: '1'},
      rows: ['hana|Tag|1'],
    });

    await endSyncSession('hana');
    expect(await Dexie.exists(db.name)).toBe(true);
    expect(await hasQueuedWrites(db.name)).toBe(true);
    // The next sign-in opens it, queue and all.
    expect(await syncSession('hana').db.outbox.count()).toBe(1);

    await endSyncSession('hana', {discardQueued: true});
    expect(await Dexie.exists(db.name)).toBe(false);
  });

  it("waits for another tab's write before deciding, and keeps the data when it queued one", async () => {
    // Web Locks across tabs (jsdom has none; Node's work alike).
    vi.stubGlobal('navigator', {...globalThis.navigator, locks});
    const {db} = syncSession('ivan');
    await db.cursors.put({owner: 'ivan', key: 'tags', after: '0,0'});
    // Another tab is making a write.
    let granted!: () => void;
    const holding = new Promise<void>(resolve => {
      granted = resolve;
    });
    let release!: () => void;
    const released = new Promise<void>(resolve => {
      release = resolve;
    });
    const writing = withDataLock(db.name, 'shared', async () => {
      granted();
      await released;
    });
    await holding;

    const ending = endSyncSession('ivan');
    // The cleanup waits for it.
    await vi.waitFor(async () => {
      const {pending = []} = await locks.query();
      expect(pending.map(lock => lock.mode)).toContain('exclusive');
    });
    // The write is queued, in the database the other tab has open.
    const other = new CommandsnippetsDatabase(db.name);
    await other.outbox.add({
      owner: 'ivan',
      made: '2026-01-01T00:00:00.000000',
      writeId: 'write-1',
      write: {kind: 'deleteTag', tagId: '1'},
      rows: ['ivan|Tag|1'],
    });
    other.close();
    release();
    await writing;
    await ending;

    expect(await hasQueuedWrites(db.name)).toBe(true);
  });

  it('deletes data kept under a name for another account of it, at sign-in', async () => {
    // Account 7 signs in, and queues a write before any sync.
    await claimData('jo', '7');
    const {db} = syncSession('jo');
    await db.outbox.add({
      owner: 'jo',
      made: '2026-01-01T00:00:00.000000',
      writeId: 'write-1',
      write: {kind: 'deleteTag', tagId: '1'},
      rows: ['jo|Tag|1'],
    });
    await endSyncSession('jo');
    expect(await Dexie.exists(db.name)).toBe(true);

    // The same account: kept, queue and all.
    await claimData('jo', '7');
    expect(await hasQueuedWrites(db.name)).toBe(true);
    // Another account of the name (the first deleted, its name taken again):
    // none of the first's data, bound to the second.
    await claimData('jo', '8');
    expect(await hasQueuedWrites(db.name)).toBe(false);
    const again = syncSession('jo');
    expect((await again.db.cursors.get(['jo', OWNER_ID_KEY]))?.after).toBe('8');
  });

  it("binds a database open here to the account signing in, wiping another's at once", async () => {
    await claimData('lee', '7');
    const {db} = syncSession('lee');
    await db.outbox.add({
      owner: 'lee',
      made: '2026-01-01T00:00:00.000000',
      writeId: 'write-1',
      write: {kind: 'deleteTag', tagId: '1'},
      rows: ['lee|Tag|1'],
    });

    await claimData('lee', '8');
    expect(db.isOpen()).toBe(true);
    expect(await db.outbox.count()).toBe(0);
    expect((await db.cursors.get(['lee', OWNER_ID_KEY]))?.after).toBe('8');
  });

  it("wipes the other users' data the database holds too, when another account takes it", async () => {
    await claimData('max', '7');
    // A staff account: it read alice's data too.
    const theirs = syncSession('max', 'alice');
    await theirs.db.cursors.put({
      owner: 'alice',
      key: 'tags',
      after: '1970-01-01T00:00:00,0',
    });

    await claimData('max', '8');
    expect(await theirs.db.cursors.get(['alice', 'tags'])).toBeUndefined();
    expect((await theirs.db.cursors.get(['max', OWNER_ID_KEY]))?.after).toBe(
      '8'
    );
  });

  it('deletes the data when the session ends', async () => {
    const {db} = syncSession('carol');
    await db.cursors.put({
      owner: 'carol',
      key: 'tags',
      after: '1970-01-01T00:00:00,0',
    });
    expect(await Dexie.exists(db.name)).toBe(true);

    await endSyncSession('carol');
    expect(await Dexie.exists(db.name)).toBe(false);
    // A new session starts empty.
    expect(await syncSession('carol').db.cursors.count()).toBe(0);
  });

  it("deletes the user's data when no session is open (after a reload)", async () => {
    // Synced before the page reloaded: the data is there, the session not.
    const name = databaseName('test', 'dave');
    const earlier = new CommandsnippetsDatabase(name);
    await earlier.cursors.put({
      owner: 'dave',
      key: 'tags',
      after: '1970-01-01T00:00:00,0',
    });
    earlier.close();
    expect(await Dexie.exists(name)).toBe(true);

    await endSyncSession('dave');
    expect(await Dexie.exists(name)).toBe(false);
  });

  it('opens anew after another tab deleted the database', async () => {
    const first = syncSession('erin');
    await first.db.cursors.put({
      owner: 'erin',
      key: 'tags',
      after: '1970-01-01T00:00:00,0',
    });
    // Another tab signs erin out: its deletion closes this tab's connection.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await Dexie.delete(first.db.name);
    expect(first.db.isOpen()).toBe(false);

    const again = syncSession('erin');
    expect(again).not.toBe(first);
    await again.db.cursors.put({
      owner: 'erin',
      key: 'tags',
      after: '1970-01-01T00:00:00,0',
    });
    expect(await again.db.cursors.count()).toBe(1);
  });
});
