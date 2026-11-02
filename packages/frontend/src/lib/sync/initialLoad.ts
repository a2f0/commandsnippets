/**
 * A first collection load's progress (`SyncCursor.initialLoad`, kept on the
 * `entries` cursor with each page, across retries): what
 * `InitialLoadProgress` shows.
 */
import {CURSOR_START} from '@commandsnippets/api-shared/cursor';
import type {CommandsnippetsDatabase, SyncCursor} from '../db/database';
import {assertBound} from './accountBinding';
import {SYNC_PAGE_SIZE} from './pageSize';

export type InitialLoad = NonNullable<SyncCursor['initialLoad']>;

/**
 * `owner`'s first-load progress: started on a fresh sign-in (no `entries`
 * cursor yet), and its total counted (`getEntryCount`) while unknown. None
 * for older cursors, which have no progress marker: their next sync still
 * reads to the end, without starting a new first-load indicator.
 */
export async function startInitialLoad(
  db: CommandsnippetsDatabase,
  reads: {getEntryCount(): Promise<number>},
  owner: string,
  ownerId: string
): Promise<InitialLoad | undefined> {
  const initialLoad = await db.transaction('rw', db.cursors, async () => {
    await assertBound(db, owner, ownerId);
    const held = await db.cursors.get([owner, 'entries']);
    if (held !== undefined) {
      return held.initialLoad;
    }
    const progress = {pages: 0, totalPages: null, complete: false};
    await db.cursors.put({
      owner,
      key: 'entries',
      after: CURSOR_START,
      initialLoad: progress,
    });
    return progress;
  });
  if (
    initialLoad === undefined ||
    initialLoad.complete ||
    initialLoad.totalPages !== null
  ) {
    return initialLoad;
  }
  // Counting is presentation only: a failed count never prevents loading
  // the entries. The UI uses an indeterminate bar until the total is known.
  const count = await reads.getEntryCount().catch((error: unknown) => {
    console.warn('WARNING: could not count entry pages:', error);
    return null;
  });
  if (count === null) {
    return initialLoad;
  }
  const counted = {
    ...initialLoad,
    totalPages: Math.max(
      Math.ceil(count / SYNC_PAGE_SIZE),
      initialLoad.pages === 0 ? 0 : initialLoad.pages + 1
    ),
  };
  await db.transaction('rw', db.cursors, async () => {
    await assertBound(db, owner, ownerId);
    await db.cursors.update([owner, 'entries'], {initialLoad: counted});
  });
  return counted;
}

/** `load` once a page of `rows` entries is stored (`done`: the last). */
export function advanceInitialLoad(
  load: InitialLoad,
  rows: number,
  done: boolean
): InitialLoad {
  const pages = load.pages + (rows > 0 ? 1 : 0);
  return {
    pages,
    // Entries may change while loading. Never show 100% with a next page
    // still to read; finishing fixes the actual total.
    totalPages: done
      ? pages
      : load.totalPages === null
        ? null
        : Math.max(load.totalPages, pages + 1),
    complete: done,
  };
}
