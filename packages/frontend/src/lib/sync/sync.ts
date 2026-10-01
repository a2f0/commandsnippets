/**
 * The sync between the API and one user's data in the signed-in user's
 * IndexedDB database (`lib/db/database.ts`): their own, or for staff another
 * user's, read through the admin API. Keyset reads (api-shared's
 * `cursor.ts`) from cursors the database keeps for that user, so a sync
 * resumes where the last one stopped, and a first one (no cursors: a fresh
 * sign-in) reads everything.
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
 * Every sync first checks that the API reads the data of the user it syncs
 * (for their own: another tab may have signed in as someone else), and
 * refuses a page with anyone else's data (`ForeignDataError`).
 */
import {CURSOR_START, cursorOf} from '@commandsnippets/api-shared/cursor';
import type {
  TagCursorListDocument,
  TagTextEntryCursorListDocument,
  TagTextEntryListDocument,
  TextEntryCursorListDocument,
} from '@commandsnippets/api-shared/responses';
import {
  type CommandsnippetsDatabase,
  type SyncCursor,
  tagCursorKey,
} from '../db/database';
import {flushOutbox, isLocalId, type OutboxApi} from './outbox';
import {checkOwner, putEntries, putJunctions, putTags} from './store';

/**
 * The API reads a sync makes: of the signed-in user's own data
 * (`apiClient`'s), or of another user's (`adminSyncApi`).
 */
export interface SyncApi {
  /** The user whose data the reads return. */
  getOwner(): Promise<{id: string; username: string}>;
  getTagsAfter(after: string): Promise<TagCursorListDocument>;
  getEntriesAfter(after: string): Promise<TextEntryCursorListDocument>;
  getTagJunctionsAfter(
    tagId: string,
    after: string
  ): Promise<TagTextEntryCursorListDocument>;
  getNewestJunction(): Promise<TagTextEntryListDocument>;
}

/** The API answers for another user than the one synced. */
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
 * Read the pages after `owner`'s stored cursor `key` (from the start without
 * one), storing each (`store`) with the cursor past it in one transaction,
 * until the last, or until `pause` (checked between pages) asks to stop.
 * Returns whether it read to the end.
 */
async function readAfter<P extends Page>(
  db: CommandsnippetsDatabase,
  owner: string,
  key: string,
  read: (after: string) => Promise<P>,
  store: (page: P) => Promise<void>,
  options: {
    cursor?: (after: string, done: boolean) => SyncCursor;
    pause?: () => boolean;
  } = {}
): Promise<boolean> {
  const {
    cursor = (after: string) => ({owner, key, after}),
    pause = () => false,
  } = options;
  let after = (await db.cursors.get([owner, key]))?.after ?? CURSOR_START;
  for (;;) {
    const page = await read(after);
    const last = page.data.at(-1);
    after = last === undefined ? after : cursorOf(last);
    const done = page.links.next === null;
    await db.transaction(
      'rw',
      [db.tags, db.entries, db.junctions, db.cursors, db.outbox],
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

/** The id of the user whose data the API reads, who must be `owner`. */
async function ownerOf(api: SyncApi, owner: string): Promise<string> {
  const {id, username} = await api.getOwner();
  if (username !== owner) {
    throw new SyncUserError(owner, username);
  }
  return id;
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

/** Sync `owner`'s collection; false when paused before its end (`pause`). */
async function syncAll(
  db: CommandsnippetsDatabase,
  api: SyncApi,
  owner: string,
  pause: () => boolean
): Promise<boolean> {
  const ownerId = await ownerOf(api, owner);
  const mark = await junctionsMark(api);
  await readAfter(
    db,
    owner,
    'tags',
    after => api.getTagsAfter(after),
    page => {
      checkOwner(ownerId, page.data);
      return putTags(db, owner, page.data);
    }
  );
  const done = await readAfter(
    db,
    owner,
    'entries',
    after => api.getEntriesAfter(after),
    page => {
      checkOwner(ownerId, [...page.data, ...(page.included ?? [])]);
      return putEntries(db, owner, page.data, page.included);
    },
    {pause}
  );
  if (!done) {
    return false;
  }
  // Every change there was when the sync began is stored now.
  await db.transaction('rw', [db.tags, db.cursors], async () => {
    for (const tag of await db.tags.where('owner').equals(owner).toArray()) {
      await db.cursors.put({
        owner,
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
  owner: string,
  tagId: string
): Promise<void> {
  // A tag created here and not on the API yet has nothing there to read.
  if (isLocalId(tagId)) {
    return;
  }
  const ownerId = await ownerOf(api, owner);
  const tag = await db.tags.get([owner, tagId]);
  if (tag === undefined) {
    return;
  }
  // The revision now: one the tag reaches while this runs may cover a change
  // it missed, so the tag syncs again then.
  const revision = tag.attributes.date_updated;
  const key = tagCursorKey(tagId);
  const held = (await db.cursors.get([owner, key]))?.revision;
  await readAfter(
    db,
    owner,
    key,
    after => api.getTagJunctionsAfter(tagId, after),
    page => {
      checkOwner(ownerId, [...page.data, ...(page.included ?? [])]);
      return putJunctions(db, owner, page.data, page.included);
    },
    {
      cursor: (after, done) => ({
        owner,
        key,
        after,
        ...(done ? {revision} : held === undefined ? {} : {revision: held}),
      }),
    }
  );
}

/**
 * Whether `owner`'s tag `tagId` is synced through the revision the database
 * holds (one created here, not on the API yet, has nothing to sync).
 */
export async function isTagSynced(
  db: CommandsnippetsDatabase,
  owner: string,
  tagId: string
): Promise<boolean> {
  if (isLocalId(tagId)) {
    return true;
  }
  const [tag, cursor] = await Promise.all([
    db.tags.get([owner, tagId]),
    db.cursors.get([owner, tagCursorKey(tagId)]),
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
  /**
   * Send the queued writes (`outbox.ts`), until none are left or one fails
   * for a reason that can pass (which this throws). Nothing to send where
   * the data is read-only.
   */
  flush(): Promise<void>;
}

/**
 * The syncs of `owner`'s data in `db` from `api`, and the flushes of their
 * queued writes to `writes` (none for read-only data), run one at a time: in
 * this tab in the order they are asked for (a tag sync ahead of the rest of
 * a collection sync), and across tabs by the Web Lock `lockName`, so the
 * answers and pages are stored in the order they were read.
 */
export function createSyncEngine(
  db: CommandsnippetsDatabase,
  api: SyncApi,
  lockName: string,
  owner: string,
  writes: OutboxApi | null = null
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
    exclusive(() => syncAll(db, api, owner, () => tagSyncsWaiting > 0)).then(
      done => (done ? undefined : syncAllToTheEnd())
    );
  // One flush at a time; one asked for while it runs runs again after it, so
  // a write queued meanwhile is sent.
  let flushing: Promise<void> | null = null;
  let flushAgain = false;
  const flush = (): Promise<void> => {
    if (writes === null) {
      return Promise.resolve();
    }
    if (flushing !== null) {
      flushAgain = true;
      return flushing;
    }
    const run = async () => {
      do {
        flushAgain = false;
        await exclusive(() => flushOutbox(db, writes, owner));
      } while (flushAgain);
    };
    flushing = run().finally(() => {
      flushing = null;
    });
    return flushing;
  };
  return {
    flush,
    syncAll: syncAllToTheEnd,
    syncTag: tagId => {
      tagSyncsWaiting += 1;
      return exclusive(() => {
        tagSyncsWaiting -= 1;
        return syncTag(db, api, owner, tagId);
      });
    },
  };
}
