/**
 * The signed-in user's database and its syncs (`sync.ts`): opened for a user
 * on first use, and deleted when they sign out. The database holds their own
 * data and, for staff, the data of the users whose data they read, each
 * user's under their username; each has its own session. Public sessions
 * use a separate database, with rows and cursors partitioned by owner.
 */
import {Dexie} from 'dexie';
import {adminSyncApi} from '../api/adminApi';
import {apiClient} from '../api/apiClient';
import {publicSyncApi} from '../api/publicApi';
import {
  CommandsnippetsDatabase,
  databaseName,
  OWNER_ID_KEY,
} from '../db/database';
import {environment} from '../environment';
import {
  bindOwner,
  createSyncEngine,
  type SyncApi,
  type SyncEngine,
} from './sync';

export interface SyncSession {
  /** The signed-in user, whose database it is. */
  username: string;
  /** Whose data it reads: the signed-in user's own, or another user's. */
  owner: string;
  /**
   * Another user's data (staff read it through the admin API): nothing
   * writes it (`lib/data/writes.ts` refuses to).
   */
  readOnly: boolean;
  db: CommandsnippetsDatabase;
  sync: SyncEngine;
}

/** The signed-in user's own data's reads (`apiClient`'s). */
export const ownSyncApi: SyncApi = {
  getOwner: async () => {
    const {data} = await apiClient.getCurrentUser();
    return {id: data.id, username: data.attributes.username};
  },
  getTagsAfter: after => apiClient.getTagsAfter(after),
  getEntriesAfter: after => apiClient.getEntriesAfter(after),
  getEntryCount: () => apiClient.getEntryCount(),
  getTagJunctionsAfter: (tagId, after) =>
    apiClient.getTagJunctionsAfter(tagId, after),
  getNewestJunction: () => apiClient.getNewestJunction(),
};

interface OpenDatabase {
  username: string;
  db: CommandsnippetsDatabase;
  /** By owner. */
  sessions: Map<string, SyncSession>;
}

let open: OpenDatabase | null = null;
let publicOpen: OpenDatabase | null = null;

/** Public rows and cursors can never inherit the owner's or staff's full view. */
export function publicSyncSession(owner: string): SyncSession {
  if (publicOpen === null || publicOpen.db.hasBeenClosed()) {
    const db = new CommandsnippetsDatabase(
      `commandsnippets-public-${environment}`
    );
    db.on('versionchange', () => {
      publicOpen = null;
      ended();
    });
    publicOpen = {username: '', db, sessions: new Map()};
  }
  let session = publicOpen.sessions.get(owner);
  if (session === undefined) {
    session = {
      username: '',
      owner,
      readOnly: true,
      db: publicOpen.db,
      sync: createSyncEngine(
        publicOpen.db,
        publicSyncApi(owner),
        `${publicOpen.db.name}:${owner}`,
        owner
      ),
    };
    publicOpen.sessions.set(owner, session);
  }
  return session;
}

// Told when the open database's sessions end, for the UI to open the next
// (`subscribeSessions`).
const listeners = new Set<() => void>();
let sessionsEnded = 0;

function ended(): void {
  sessionsEnded += 1;
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Call `listener` whenever the open sessions end (a sign-out, here or in
 * another tab): the next `syncSession` opens another. Returns the
 * unsubscribe.
 */
export function subscribeSessions(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** How many times sessions have ended: it changes when they do. */
export const sessionsEndedCount = (): number => sessionsEnded;

/**
 * `username`'s session of `owner`'s data (their own by default), opening
 * `username`'s database (and closing another user's). Sessions end when
 * another tab deletes or upgrades the database (a sign-out there): the next
 * opens it anew.
 */
export function syncSession(
  username: string,
  owner: string = username
): SyncSession {
  if (open?.username !== username || open.db.hasBeenClosed()) {
    open?.db.close();
    const db = new CommandsnippetsDatabase(databaseName(environment, username));
    // Dexie closes the connection then (its own listener).
    db.on('versionchange', () => {
      if (open?.db === db) {
        open = null;
        ended();
      }
    });
    open = {username, db, sessions: new Map()};
  }
  const {db, sessions} = open;
  let session = sessions.get(owner);
  if (session === undefined) {
    const readOnly = owner !== username;
    session = {
      username,
      owner,
      readOnly,
      db,
      sync: readOnly
        ? createSyncEngine(
            db,
            adminSyncApi(owner),
            `${db.name}:${owner}`,
            owner
          )
        : createSyncEngine(
            db,
            ownSyncApi,
            `${db.name}:${owner}`,
            owner,
            // Every queued write names its owner, whoever is signed in when
            // it is sent.
            apiClient.writesAs(username)
          ),
    };
    sessions.set(owner, session);
  }
  return session;
}

/**
 * Run `task` holding the Web Lock of the database `name`'s data, across
 * tabs: each write holds it shared (`lib/data/writes.ts`), a sign-out's
 * cleanup exclusively (`endSyncSession`), so the cleanup sees every write
 * committed before it, and none is made while it decides whether to delete
 * the database (one waiting finds the database closed, or opens it anew).
 */
export function withDataLock<T>(
  name: string,
  mode: LockMode,
  task: () => Promise<T>
): Promise<T> {
  const locks = globalThis.navigator?.locks;
  return locks === undefined
    ? task()
    : locks.request(`commandsnippets-data:${name}`, {mode}, task);
}

/**
 * Before user `userId` signs in as `username`: data kept here under that
 * name for another account of it (deleted since, its name taken again) is
 * deleted, queued writes and all, never shown or sent as theirs; and the
 * data is bound to this account from the start, so writes queued before
 * any sync are never taken for another's either. (A session binds the data
 * it opens too: `bindOwner`.)
 */
export async function claimData(
  username: string,
  userId: string
): Promise<void> {
  const name = databaseName(environment, username);
  await withDataLock(name, 'exclusive', async () => {
    if (await Dexie.exists(name)) {
      const kept = new CommandsnippetsDatabase(name);
      let held: string | undefined;
      try {
        held = (await kept.cursors.get([username, OWNER_ID_KEY]))?.after;
      } finally {
        kept.close();
      }
      if (held !== undefined && held !== userId) {
        if (open?.db.name === name) {
          // Open here: bound (and so wiped) in place.
          await bindOwner(open.db, username, userId);
          return;
        }
        await Dexie.delete(name);
      }
    }
    const db = new CommandsnippetsDatabase(name);
    try {
      await bindOwner(db, username, userId);
    } finally {
      db.close();
    }
  });
}

/** Whether the database `name` holds writes not sent to the API yet. */
export async function hasQueuedWrites(name: string): Promise<boolean> {
  if (!(await Dexie.exists(name))) {
    return false;
  }
  const db = new CommandsnippetsDatabase(name);
  try {
    return (await db.outbox.count()) > 0;
  } finally {
    db.close();
  }
}

/**
 * Sign `username` out: close the open database, and delete their data (and
 * any other user's it holds) whether or not this page opened it (they may
 * have synced before a reload). A database still holding queued writes is
 * kept, so they are not lost (the session expired offline, say): the user's
 * next sign-in here sends them. `discardQueued` deletes it all the same.
 */
export async function endSyncSession(
  username: string | null,
  {discardQueued = false}: {discardQueued?: boolean} = {}
): Promise<void> {
  const ending = open;
  open = null;
  ending?.db.close();
  if (ending !== null) {
    ended();
  }
  const names = new Set<string>();
  if (ending !== null) {
    names.add(ending.db.name);
  }
  if (username !== null) {
    names.add(databaseName(environment, username));
  }
  await Promise.all(
    [...names].map(name =>
      withDataLock(name, 'exclusive', async () => {
        if (!discardQueued && (await hasQueuedWrites(name))) {
          return;
        }
        // Opened again meanwhile (the user signed in again): it stays.
        if (open?.db.name === name) {
          return;
        }
        await Dexie.delete(name);
      })
    )
  );
}
