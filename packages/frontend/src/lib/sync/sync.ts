/**
 * The sync between the API and the signed-in user's IndexedDB database
 * (`lib/db/database.ts`): keyset reads (api-shared's `cursor.ts`) from
 * cursors the database keeps, so a sync resumes where the last one stopped,
 * and a first one (no cursors: a fresh sign-in) reads everything.
 *
 * - `syncAll` syncs the whole collection: the tags changed since the `tags`
 *   cursor, then the entries (with their junctions) changed since the
 *   `entries` cursor. Each page is stored with the cursor past it in one
 *   transaction. When the entries are read to the end, every tag gets a
 *   cursor of its own: the newest junction revision there was when the sync
 *   began (every later change gets a newer one), with the tag's revision the
 *   tags read listed. Only then: until the entries are all read, a tag's
 *   junctions may be older than that revision, or missing.
 * - `syncTag` syncs one tag: its junctions changed since its cursor (deleted
 *   ones too: entries that left it), from the start without one, with their
 *   entries. A tag is synced through its revision (the API advances it
 *   whenever anything in it changes) when its cursor holds that revision
 *   (`isTagSynced`).
 *
 * Syncs run one at a time, in this tab and across tabs (a Web Lock, where
 * the browser has them), so each response is stored in the order it was
 * read: a response never undoes what a later-read one stored. A tag sync
 * asked for while the collection syncs (the tag shown, on a first sign-in)
 * runs between two pages of it, which then goes on from its cursor.
 *
 * Every sync first checks that the API's user is the database's (another tab
 * may have signed in as someone else), and refuses a page with anyone else's
 * data (`ForeignDataError`).
 */
import {CURSOR_START, cursorOf} from '@commandsnippets/api-shared/cursor';
import type {
  TagCursorListDocument,
  TagTextEntryCursorListDocument,
  TagTextEntryListDocument,
  TextEntryCursorListDocument,
  UserDocument,
} from '@commandsnippets/api-shared/responses';
import {
  type CommandsnippetsDatabase,
  type SyncCursor,
  tagCursorKey,
} from '../db/database';
import {checkOwner, putEntries, putJunctions, putTags} from './store';

/** The API reads a sync makes (`apiClient`'s). */
export interface SyncApi {
  getCurrentUser(): Promise<UserDocument>;
  getTagsAfter(after: string): Promise<TagCursorListDocument>;
  getEntriesAfter(after: string): Promise<TextEntryCursorListDocument>;
  getTagJunctionsAfter(
    tagId: string,
    after: string
  ): Promise<TagTextEntryCursorListDocument>;
  getNewestJunction(): Promise<TagTextEntryListDocument>;
}

/** The API answers for another user than the database's. */
export class SyncUserError extends Error {
  constructor(expected: string, actual: string) {
    super(`The API's user is ${actual}, not ${expected}: not synced`);
    this.name = 'SyncUserError';
  }
}

type Page = {
  data: ReadonlyArray<{id: string; attributes: {date_updated: string}}>;
  links: {next: string | null};
};

/**
 * Read the pages after the stored cursor `key` (from the start without one),
 * storing each (`store`) with the cursor past it in one transaction, until
 * the last, or until `pause` (checked between pages) asks to stop. Returns
 * whether it read to the end.
 */
async function readAfter<P extends Page>(
  db: CommandsnippetsDatabase,
  key: string,
  read: (after: string) => Promise<P>,
  store: (page: P) => Promise<void>,
  options: {
    cursor?: (after: string, done: boolean) => SyncCursor;
    pause?: () => boolean;
  } = {}
): Promise<boolean> {
  const {cursor = (after: string) => ({key, after}), pause = () => false} =
    options;
  let after = (await db.cursors.get(key))?.after ?? CURSOR_START;
  for (;;) {
    const page = await read(after);
    const last = page.data.at(-1);
    after = last === undefined ? after : cursorOf(last);
    const done = page.links.next === null;
    await db.transaction(
      'rw',
      [db.tags, db.entries, db.junctions, db.cursors],
      async () => {
        await store(page);
        await db.cursors.put(cursor(after, done));
      }
    );
    if (done) {
      return true;
    }
    if (pause()) {
      return false;
    }
  }
}

/** The API's user id, which must be `username`'s. */
async function ownerOf(api: SyncApi, username: string): Promise<string> {
  const {data} = await api.getCurrentUser();
  if (data.attributes.username !== username) {
    throw new SyncUserError(username, data.attributes.username);
  }
  return data.id;
}

/**
 * The cursor past every junction revision there is now: the newest one's,
 * past any id (one write stamps many junctions alike).
 */
async function junctionsMark(api: SyncApi): Promise<string> {
  const [newest] = (await api.getNewestJunction()).data;
  return newest === undefined
    ? CURSOR_START
    : `${newest.attributes.date_updated},${Number.MAX_SAFE_INTEGER}`;
}

/** Sync the collection; false when paused before its end (`pause`). */
async function syncAll(
  db: CommandsnippetsDatabase,
  api: SyncApi,
  username: string,
  pause: () => boolean
): Promise<boolean> {
  const owner = await ownerOf(api, username);
  const mark = await junctionsMark(api);
  await readAfter(
    db,
    'tags',
    after => api.getTagsAfter(after),
    page => {
      checkOwner(owner, page.data);
      return putTags(db, page.data);
    }
  );
  const done = await readAfter(
    db,
    'entries',
    after => api.getEntriesAfter(after),
    page => {
      checkOwner(owner, [...page.data, ...(page.included ?? [])]);
      return putEntries(db, page.data, page.included);
    },
    {pause}
  );
  if (!done) {
    return false;
  }
  // Every change there was when the sync began is stored now.
  await db.transaction('rw', [db.tags, db.cursors], async () => {
    for (const tag of await db.tags.toArray()) {
      await db.cursors.put({
        key: tagCursorKey(tag.id),
        after: mark,
        revision: tag.attributes.date_updated,
      });
    }
  });
  return true;
}

async function syncTag(
  db: CommandsnippetsDatabase,
  api: SyncApi,
  username: string,
  tagId: string
): Promise<void> {
  const owner = await ownerOf(api, username);
  const tag = await db.tags.get(tagId);
  if (tag === undefined) {
    return;
  }
  // The revision now: one the tag reaches while this runs may cover a change
  // it missed, so the tag syncs again then.
  const revision = tag.attributes.date_updated;
  const key = tagCursorKey(tagId);
  const held = (await db.cursors.get(key))?.revision;
  await readAfter(
    db,
    key,
    after => api.getTagJunctionsAfter(tagId, after),
    page => {
      checkOwner(owner, [...page.data, ...(page.included ?? [])]);
      return putJunctions(db, page.data, page.included);
    },
    {
      cursor: (after, done) => ({
        key,
        after,
        ...(done ? {revision} : held === undefined ? {} : {revision: held}),
      }),
    }
  );
}

/** Whether tag `tagId` is synced through the revision the database holds. */
export async function isTagSynced(
  db: CommandsnippetsDatabase,
  tagId: string
): Promise<boolean> {
  const [tag, cursor] = await Promise.all([
    db.tags.get(tagId),
    db.cursors.get(tagCursorKey(tagId)),
  ]);
  return (
    tag !== undefined &&
    cursor?.revision !== undefined &&
    cursor.revision === tag.attributes.date_updated
  );
}

export interface SyncEngine {
  /** Sync the whole collection (see the module comment). */
  syncAll(): Promise<void>;
  /** Sync one tag (see the module comment). */
  syncTag(tagId: string): Promise<void>;
}

/**
 * The syncs of `username`'s database `db` from `api`, run one at a time: in
 * this tab in the order they are asked for (a tag sync ahead of the rest of
 * a collection sync), and across tabs by the Web Lock `lockName`.
 */
export function createSyncEngine(
  db: CommandsnippetsDatabase,
  api: SyncApi,
  lockName: string,
  username: string
): SyncEngine {
  let queue: Promise<unknown> = Promise.resolve();
  let tagSyncsWaiting = 0;
  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const locks = globalThis.navigator?.locks;
    const run = () =>
      locks === undefined ? task() : locks.request(lockName, task);
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  };
  const syncAllToTheEnd = (): Promise<void> =>
    exclusive(() => syncAll(db, api, username, () => tagSyncsWaiting > 0)).then(
      done => (done ? undefined : syncAllToTheEnd())
    );
  return {
    syncAll: syncAllToTheEnd,
    syncTag: tagId => {
      tagSyncsWaiting += 1;
      return exclusive(() => {
        tagSyncsWaiting -= 1;
        return syncTag(db, api, username, tagId);
      });
    },
  };
}
