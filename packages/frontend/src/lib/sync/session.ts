/**
 * The signed-in user's database and its sync (`sync.ts`): opened for a user
 * on first use, and deleted when they sign out.
 */
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
    session = {username, db, sync: createSyncEngine(db, apiClient, name)};
  }
  return session;
}

/** Sign out: close the open session and delete its data. */
export async function endSyncSession(): Promise<void> {
  const ending = session;
  session = null;
  if (ending !== null) {
    ending.db.close();
    await ending.db.delete();
  }
}
