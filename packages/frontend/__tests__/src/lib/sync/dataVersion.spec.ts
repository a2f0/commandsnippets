/**
 * Data versions in the sync (src/lib/sync/dataVersion.ts): the rows held are
 * of one version, every read and queued write names it, and a switch to
 * another (a restore, here or elsewhere) clears the copy, which the next
 * sync reads from the start. Against the E2E handlers' mock API.
 */
import {DATA_VERSION_HEADER} from '@commandsnippets/api-shared';
import invariant from 'invariant';
import {http} from 'msw';
import {setupServer} from 'msw/node';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {apiClient} from '../../../../src/lib/api/apiClient';
import {
  CommandsnippetsDatabase,
  OWNER_ID_KEY,
  VERSION_KEY,
} from '../../../../src/lib/db/database';
import {adoptVersion, heldVersion} from '../../../../src/lib/sync/dataVersion';
import {enqueue} from '../../../../src/lib/sync/outbox';
import {ownSyncApi} from '../../../../src/lib/sync/session';
import {createSyncEngine} from '../../../../src/lib/sync/sync';
import {handlers, resetMSWState} from '../../../../src/msw/handlers';
import {restoreElsewhere} from '../../../util/restoreElsewhere';
import {entry, tag} from '../../../util/storeFixtures';

const API = 'http://localhost:9001/api/v1';
const OWNER = 'test';

const server = setupServer(...handlers);

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterAll(() => server.close());

let db: CommandsnippetsDatabase;
let databases = 0;
beforeEach(() => {
  resetMSWState();
  // The handlers announce each request.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  databases += 1;
  db = new CommandsnippetsDatabase(`data-version-spec-${databases}`);
});
afterEach(async () => {
  vi.restoreAllMocks();
  server.resetHandlers();
  server.events.removeAllListeners();
  await db.delete();
});

const engine = () =>
  createSyncEngine(
    db,
    ownSyncApi,
    `data-version-spec-${databases}`,
    OWNER,
    apiClient.writesAs(OWNER)
  );

const entryIds = async () =>
  (await db.entries.where('owner').equals(OWNER).toArray())
    .map(row => row.id)
    .sort();

/** The data version each request to the API named. */
function versionsNamed(): (string | null)[] {
  const named: (string | null)[] = [];
  server.events.on('request:start', ({request}) => {
    if (!new URL(request.url).pathname.endsWith('/user/')) {
      named.push(request.headers.get(DATA_VERSION_HEADER));
    }
  });
  return named;
}

/**
 * Hold the first `method` request to `path` until released; the handlers
 * then answer it.
 */
function gate(method: 'get' | 'delete', path: string) {
  let release = () => {};
  const released = new Promise<void>(resolve => {
    release = resolve;
  });
  let reach = () => {};
  const reached = new Promise<void>(resolve => {
    reach = resolve;
  });
  let held = false;
  server.use(
    http[method](`${API}${path}`, async () => {
      if (!held) {
        held = true;
        reach();
        await released;
      }
      return undefined;
    })
  );
  return {reached, release};
}

const queuedVersions = async () =>
  (await db.outbox.toArray()).map(({version}) => version);

describe('adoptVersion', () => {
  it('holds the first version read of data never read: what was made here stays', async () => {
    await db.cursors.put({owner: OWNER, key: OWNER_ID_KEY, after: '1'});
    await db.entries.put({...entry('local-1', {}), owner: OWNER});
    await enqueue(
      db,
      OWNER,
      {kind: 'deleteEntry', entryId: 'local-1'},
      '2026-01-01T00:00:00.000000'
    );
    expect(await queuedVersions()).toEqual([undefined]);

    expect(await adoptVersion(db, OWNER, 1)).toBe(false);

    expect(await heldVersion(db, OWNER)).toBe(1);
    expect(await entryIds()).toEqual(['local-1']);
    // Queued before any version was held: of the one first read.
    expect(await queuedVersions()).toEqual([1]);
    // The same version again changes nothing.
    expect(await adoptVersion(db, OWNER, 1)).toBe(false);
    expect(await entryIds()).toEqual(['local-1']);
  });

  it('clears data read with no version held, of none known', async () => {
    await db.entries.put({...entry('1', {}), owner: OWNER});
    await db.cursors.bulkPut([
      {owner: OWNER, key: OWNER_ID_KEY, after: '1'},
      {owner: OWNER, key: 'entries', after: '2026-01-01T00:00:00,1'},
    ]);
    await enqueue(
      db,
      OWNER,
      {kind: 'deleteEntry', entryId: '1'},
      '2026-01-01T00:00:00.000000'
    );

    expect(await adoptVersion(db, OWNER, 1)).toBe(true);

    expect(await entryIds()).toEqual([]);
    expect(await db.outbox.count()).toBe(0);
    expect(
      (await db.cursors.where('owner').equals(OWNER).toArray())
        .map(({key}) => key)
        .sort()
    ).toEqual([VERSION_KEY, OWNER_ID_KEY].sort());
    expect(await heldVersion(db, OWNER)).toBe(1);
  });

  it("clears an owner's rows of another version, but the account's binding", async () => {
    await adoptVersion(db, OWNER, 1);
    await db.entries.put({...entry('1', {}), owner: OWNER});
    await db.tags.put({...tag('2', {}), owner: OWNER});
    await db.entries.put({...entry('9', {}), owner: 'alice'});
    await db.cursors.bulkPut([
      {owner: OWNER, key: OWNER_ID_KEY, after: '1'},
      {owner: OWNER, key: 'entries', after: '2026-01-01T00:00:00,1'},
    ]);
    await enqueue(
      db,
      OWNER,
      {kind: 'deleteEntry', entryId: '1'},
      '2026-01-01T00:00:00.000000'
    );

    expect(await adoptVersion(db, OWNER, 2)).toBe(true);

    expect(await entryIds()).toEqual([]);
    expect(await db.tags.where('owner').equals(OWNER).count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
    expect(
      (await db.cursors.where('owner').equals(OWNER).toArray())
        .map(({key}) => key)
        .sort()
    ).toEqual([VERSION_KEY, OWNER_ID_KEY].sort());
    expect(await heldVersion(db, OWNER)).toBe(2);
    // Another owner's rows (staff read them) are theirs to keep.
    expect(await db.entries.where('owner').equals('alice').count()).toBe(1);
  });
});

describe('the sync', () => {
  it('names the version its rows are of in every read', async () => {
    const named = versionsNamed();
    await engine().syncAll();
    expect(await heldVersion(db, OWNER)).toBe(1);
    expect(named.length).toBeGreaterThan(0);
    expect(new Set(named)).toEqual(new Set(['1']));
  });

  it('reads another version from the start once it is active', async () => {
    const sync = engine();
    await sync.syncAll();
    const before = await entryIds();
    expect(before.length).toBeGreaterThan(0);

    await restoreElsewhere();
    await sync.syncAll();

    expect(await heldVersion(db, OWNER)).toBe(2);
    const after = await entryIds();
    expect(after).toHaveLength(before.length);
    expect(after.some(id => before.includes(id))).toBe(false);
  });

  it('starts again at the active version when one changes under it', async () => {
    const sync = engine();
    await sync.syncAll();
    const before = await entryIds();
    // The owner is read (version 1); another device restores before the
    // first page is, which is then refused as of another version.
    let restored = false;
    server.use(
      http.get(`${API}/tags`, async () => {
        if (!restored) {
          restored = true;
          await restoreElsewhere();
        }
        return undefined;
      })
    );
    const named = versionsNamed();

    await sync.syncAll();

    expect(restored).toBe(true);
    expect(named).toContain('1');
    expect(named).toContain('2');
    expect(await heldVersion(db, OWNER)).toBe(2);
    const after = await entryIds();
    expect(after).toHaveLength(before.length);
    expect(after.some(id => before.includes(id))).toBe(false);
  });

  it('adopts a version in turn with a sync: a page read before it is stored first', async () => {
    const sync = engine();
    const tags = gate('get', '/tags');
    const syncing = sync.syncAll();
    await tags.reached;
    let adopted = false;
    const adopting = sync.adopt(2).then(() => {
      adopted = true;
    });
    await new Promise(resolve => setTimeout(resolve, 20));
    // Its turn is after the sync's.
    expect(adopted).toBe(false);

    tags.release();
    await syncing;
    await adopting;

    expect(await heldVersion(db, OWNER)).toBe(2);
    expect(await entryIds()).toEqual([]);
    expect(await db.tags.where('owner').equals(OWNER).count()).toBe(0);
  });

  it('stores no page of a version this copy no longer holds', async () => {
    const sync = engine();
    const tags = gate('get', '/tags');
    const syncing = sync.syncAll();
    await tags.reached;
    // Held at another version out of turn (a tab the lock did not reach).
    await adoptVersion(db, OWNER, 2);
    tags.release();

    await syncing;

    // Not stored at version 2: the sync took the active one up again, and
    // read it from the start.
    expect(await heldVersion(db, OWNER)).toBe(1);
    expect((await entryIds()).length).toBeGreaterThan(0);
  });

  it('stores no answer to a write of a version this copy no longer holds', async () => {
    const sync = engine();
    await sync.syncAll();
    const [first] = await entryIds();
    invariant(first, 'the mock has entries');
    await enqueue(
      db,
      OWNER,
      {kind: 'deleteEntry', entryId: first},
      '2026-01-01T00:00:00.000000'
    );
    const deleting = gate('delete', `/entries/${first}`);
    const flushing = sync.flush();
    await deleting.reached;
    await adoptVersion(db, OWNER, 2);
    deleting.release();

    await flushing;

    // Not stored at version 2: the copy holds the active version again.
    expect(await heldVersion(db, OWNER)).toBe(1);
    expect(await db.entries.get([OWNER, first])).toBeUndefined();
  });

  it('drops the writes queued against a version no longer active', async () => {
    const sync = engine();
    await sync.syncAll();
    const [first] = await entryIds();
    await enqueue(
      db,
      OWNER,
      {kind: 'deleteEntry', entryId: first ?? ''},
      '2026-01-01T00:00:00.000000'
    );
    const [queued] = await db.outbox.toArray();
    expect(queued?.version).toBe(1);

    await restoreElsewhere();
    await sync.flush();

    expect(await db.outbox.count()).toBe(0);
    expect(await heldVersion(db, OWNER)).toBe(2);
  });
});
