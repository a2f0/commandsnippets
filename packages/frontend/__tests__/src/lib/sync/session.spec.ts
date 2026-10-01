import Dexie from 'dexie';
import {afterEach, describe, expect, it, vi} from 'vitest';

import {
  CommandsnippetsDatabase,
  databaseName,
} from '../../../../src/lib/db/database';
import {
  endSyncSession,
  hasQueuedWrites,
  syncSession,
} from '../../../../src/lib/sync/session';

afterEach(() => endSyncSession(null));

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
