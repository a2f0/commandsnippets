/**
 * The signed-in user's database and its sync (`sync.ts`): opened for a user
 * on first use, and deleted when they sign out.
 */
import {Dexie} from 'dexie';
import {apiClient} from '../api/apiClient';
import {CommandsnippetsDatabase, databaseName} from '../db/database';
import {environment} from '../environment';
import {createSyncEngine, type SyncEngine} from './sync';

export interface SyncSession {
  username: string;
  db: CommandsnippetsDatabase;
  sync: SyncEngine;
}

let session: SyncSession | null = null;

// Told when the open session ends, for the UI to open the next
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
 * Call `listener` whenever the open session ends (a sign-out, here or in
 * another tab): the next `syncSession` opens another. Returns the
 * unsubscribe.
 */
export function subscribeSessions(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** How many sessions have ended: it changes when one does. */
export const sessionsEndedCount = (): number => sessionsEnded;

/**
 * `username`'s session, opening it (and closing another user's). A session
 * ends when another tab deletes or upgrades its database (a sign-out there):
 * the next is opened anew.
 */
export function syncSession(username: string): SyncSession {
  if (session?.username !== username || session.db.hasBeenClosed()) {
    session?.db.close();
    const name = databaseName(environment, username);
    const db = new CommandsnippetsDatabase(name);
    // Dexie closes the connection then (its own listener).
    db.on('versionchange', () => {
      if (session?.db === db) {
        session = null;
        ended();
      }
    });
    session = {
      username,
      db,
      sync: createSyncEngine(db, apiClient, name, username),
    };
  }
  return session;
}

/**
 * Sign `username` out: close the open session, and delete their data whether
 * or not this page opened it (they may have synced before a reload).
 */
export async function endSyncSession(username: string | null): Promise<void> {
  const ending = session;
  session = null;
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
