/**
 * The signed-in user's database and its syncs (`sync.ts`): opened for a user
 * on first use, and deleted when they sign out. The database holds their own
 * data and, for staff, the data of the users whose data they read, each
 * user's under their username; each has its own session.
 */
import {Dexie} from 'dexie';
import {adminSyncApi} from '../api/adminApi';
import {apiClient} from '../api/apiClient';
import {CommandsnippetsDatabase, databaseName} from '../db/database';
import {environment} from '../environment';
import {createSyncEngine, type SyncApi, type SyncEngine} from './sync';

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
            apiClient
          ),
    };
    sessions.set(owner, session);
  }
  return session;
}

/**
 * Sign `username` out: close the open database, and delete their data (and
 * any other user's it holds) whether or not this page opened it (they may
 * have synced before a reload).
 */
export async function endSyncSession(username: string | null): Promise<void> {
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
  await Promise.all([...names].map(name => Dexie.delete(name)));
}
