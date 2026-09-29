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

/** `username`'s session, opening it (and closing another user's). */
export function syncSession(username: string): SyncSession {
  if (session?.username !== username) {
    session?.db.close();
    const name = databaseName(environment, username);
    const db = new CommandsnippetsDatabase(name);
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
  const names = new Set<string>();
  if (ending !== null) {
    names.add(ending.db.name);
  }
  if (username !== null) {
    names.add(databaseName(environment, username));
  }
  await Promise.all([...names].map(name => Dexie.delete(name)));
}
