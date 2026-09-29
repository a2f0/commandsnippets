import Dexie from 'dexie';
import {afterEach, describe, expect, it} from 'vitest';

import {databaseName} from '../../../../src/lib/db/database';
import {endSyncSession, syncSession} from '../../../../src/lib/sync/session';

afterEach(() => endSyncSession());

describe('syncSession', () => {
  it("opens the user's own database, one at a time", async () => {
    const alice = syncSession('alice');
    expect(syncSession('alice')).toBe(alice);
    expect(alice.db.name).toBe(databaseName('test', 'alice'));

    const bob = syncSession('bob');
    expect(bob.db.name).toBe(databaseName('test', 'bob'));
    expect(alice.db.isOpen()).toBe(false);
  });

  it('deletes the data when the session ends', async () => {
    const {db} = syncSession('carol');
    await db.cursors.put({key: 'tags', after: '1970-01-01T00:00:00,0'});
    expect(await Dexie.exists(db.name)).toBe(true);

    await endSyncSession();
    expect(await Dexie.exists(db.name)).toBe(false);
    // A new session starts empty.
    expect(await syncSession('carol').db.cursors.count()).toBe(0);
  });
});
