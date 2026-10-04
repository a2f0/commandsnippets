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
 *
 * The stores and checks are timed for the HUD (`lib/metrics/`); the reads
 * are, as every API request is (`fetchApi`).
 */
import {CURSOR_START, cursorOf} from '@commandsnippets/api-shared/cursor';
import type {
  TagCursorListDocument,
  TagTextEntryCursorListDocument,
  TagTextEntryListDocument,
  TextEntryCursorListDocument,
} from '@commandsnippets/api-shared/responses';
import {Dexie, type Table} from 'dexie';
import {
  type CommandsnippetsDatabase,
  databaseName,
  OWNER_ID_KEY,
  type RowKey,
  type Stored,
  type SyncCursor,
  tagCursorKey,
} from '../db/database';
import {environment} from '../environment';
import {timed} from '../metrics/timings';
import {
  AccountChangedError,
  adoptCreates,
  announceRemaps,
  assertBound,
  flushOutbox,
  isLocalId,
  type OutboxApi,
  type Remap,
} from './outbox';
import {SYNC_PAGE_SIZE} from './pageSize';
import {PublicViewChangedError} from './publicView';
import {checkOwner, putEntries, putJunctions, putTags} from './store';

/**
 * The API reads a sync makes: of the signed-in user's own data
 * (`apiClient`'s), or of another user's (`adminSyncApi`).
 */
export interface SyncApi {
  /** The user whose data the reads return. */
  getOwner(): Promise<{id: string; username: string; publicRevision?: number}>;
  getTagsAfter(after: string): Promise<TagCursorListDocument>;
  getEntriesAfter(after: string): Promise<TextEntryCursorListDocument>;
  /** Counts the same rows the entry cursor reads, including deletions. */
  getEntryCount(): Promise<number>;
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
 * The local ids a page's store replaced (`adoptCreates`) are announced once
 * it commits. Returns whether it read to the end.
 */
async function readAfter<P extends Page>(
  db: CommandsnippetsDatabase,
  owner: string,
  /** The account the sync bound the data to (`bindToApi`). */
  account: string,
  key: string,
  read: (after: string) => Promise<P>,
  store: (page: P) => Promise<Remap[]>,
  options: {
    cursor?: (after: string, done: boolean, page: P) => SyncCursor;
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
    const remaps = await timed(
      'idb',
      `sync store ${key.startsWith('tag:') ? 'tag junctions' : key}`,
      () =>
        db.transaction(
          'rw',
          [db.tags, db.entries, db.junctions, db.cursors, db.outbox],
          async () => {
            // Bound to another account since the sync began: not stored.
            await assertBound(db, owner, account);
            const stored = await store(page);
            await db.cursors.put(cursor(after, done, page));
            return stored;
          }
        ),
      () => `${page.data.length} rows`
    );
    announceRemaps(remaps);
    if (done) {
      return true;
    }
    if (pause()) {
      return false;
    }
  }
}

/** The id of the user whose data the API reads, who must be `owner`. */
async function ownerOf(api: SyncApi, owner: string) {
  const identity = await api.getOwner();
  const {username} = identity;
  if (username !== owner) {
    throw new SyncUserError(owner, username);
  }
  return identity;
}

/** The account a stored row of `owner`'s in `table` names, if any does. */
const accountIn = async <
  R extends {relationships: {user: {data: {id: string}}}},
>(
  table: Table<Stored<R>, RowKey>,
  owner: string
): Promise<string | undefined> =>
  (
    await table
      .where('owner')
      .equals(owner)
      .filter(row => row.relationships.user.data.id !== '')
      .first()
  )?.relationships.user.data.id;

/** The account `owner`'s stored rows name, if any does. */
async function accountOfRows(
  db: CommandsnippetsDatabase,
  owner: string
): Promise<string | undefined> {
  return (
    (await accountIn(db.tags, owner)) ??
    (await accountIn(db.entries, owner)) ??
    (await accountIn(db.junctions, owner))
  );
}

/** The account `owner`'s data is bound to (`bindOwner`), if it is. */
export const boundAccount = async (
  db: CommandsnippetsDatabase,
  owner: string
): Promise<string | undefined> =>
  (await db.cursors.get([owner, OWNER_ID_KEY]))?.after;

/**
 * Bind `owner`'s data to the account the API reads under that name
 * (`ownerId`): data another account of the name left here (deleted since,
 * its name taken again) goes, queued writes and all, before any of it is
 * shown again or sent as this account's; for the signed-in user's own (the
 * database is theirs), so does every other user's data it holds (staff
 * read it). With `asRead` (the binding read before asking the API which
 * account it is), a binding made since (a sign-in here) stands: refused
 * (`AccountChangedError`) rather than undone.
 */
export async function bindOwner(
  db: CommandsnippetsDatabase,
  owner: string,
  ownerId: string,
  asRead?: {held: string | undefined}
): Promise<void> {
  await db.transaction(
    'rw',
    [db.tags, db.entries, db.junctions, db.cursors, db.outbox],
    async () => {
      const bound = await boundAccount(db, owner);
      if (asRead !== undefined && bound !== asRead.held) {
        throw new AccountChangedError(owner);
      }
      // Data kept from before accounts were bound (an older version's): its
      // rows name their account.
      const held = bound ?? (await accountOfRows(db, owner));
      if (held === ownerId) {
        await db.cursors.put({owner, key: OWNER_ID_KEY, after: ownerId});
        return;
      }
      if (held !== undefined) {
        if (db.name === databaseName(environment, owner)) {
          for (const table of [
            db.tags,
            db.entries,
            db.junctions,
            db.cursors,
            db.outbox,
          ]) {
            await table.clear();
          }
        } else {
          for (const table of [db.tags, db.entries, db.junctions, db.outbox]) {
            await table.where('owner').equals(owner).delete();
          }
          await db.cursors
            .where('[owner+key]')
            .between([owner, Dexie.minKey], [owner, Dexie.maxKey])
            .delete();
        }
      }
      await db.cursors.put({owner, key: OWNER_ID_KEY, after: ownerId});
    }
  );
}

/**
 * Bind `owner`'s data to the account the API reads under that name, read
 * now (see `bindOwner`); returns its id.
 */
async function bindToApi(
  db: CommandsnippetsDatabase,
  api: SyncApi,
  owner: string
): Promise<string> {
  const held = await boundAccount(db, owner);
  const {id: ownerId, publicRevision} = await ownerOf(api, owner);
  await timed('idb', 'sync bindOwner', () =>
    bindOwner(db, owner, ownerId, {held})
  );
  if (publicRevision !== undefined) {
    await db.transaction(
      'rw',
      [db.tags, db.entries, db.junctions, db.cursors],
      async () => {
        const revision = String(publicRevision);
        if (
          (await db.cursors.get([owner, 'public_revision']))?.after !== revision
        ) {
          await clearPublicOwner(db, owner);
          await db.cursors.put({owner, key: OWNER_ID_KEY, after: ownerId});
          await db.cursors.put({
            owner,
            key: 'public_revision',
            after: revision,
          });
        }
      }
    );
  }
  return ownerId;
}

/** Only a public cache uses this: never removes an owner's queued writes. */
async function clearPublicOwner(
  db: CommandsnippetsDatabase,
  owner: string
): Promise<void> {
  await db.transaction(
    'rw',
    [db.tags, db.entries, db.junctions, db.cursors],
    async () => {
      for (const table of [db.tags, db.entries, db.junctions, db.cursors]) {
        await table.where('owner').equals(owner).delete();
      }
    }
  );
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
  const ownerId = await bindToApi(db, api, owner);
  // Older cursors have no progress marker; their next sync still reads to
  // the end, without starting a new first-load indicator.
  let initialLoad = await db.transaction('rw', db.cursors, async () => {
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
    initialLoad !== undefined &&
    !initialLoad.complete &&
    initialLoad.totalPages === null
  ) {
    // Counting is presentation only: a failed count never prevents loading
    // the entries. The UI uses an indeterminate bar until the total is known.
    const count = await api.getEntryCount().catch((error: unknown) => {
      console.warn('WARNING: could not count entry pages:', error);
      return null;
    });
    if (count !== null) {
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
      initialLoad = counted;
    }
  }
  const mark = await junctionsMark(api);
  await readAfter(
    db,
    owner,
    ownerId,
    'tags',
    after => api.getTagsAfter(after),
    async page => {
      checkOwner(ownerId, page.data);
      const remaps = await adoptCreates(db, owner, page.data);
      await putTags(db, owner, page.data);
      return remaps;
    }
  );
  const done = await readAfter(
    db,
    owner,
    ownerId,
    'entries',
    after => api.getEntriesAfter(after),
    async page => {
      checkOwner(ownerId, [...page.data, ...(page.included ?? [])]);
      const remaps = await adoptCreates(db, owner, [
        ...page.data,
        ...(page.included ?? []),
      ]);
      await putEntries(db, owner, page.data, page.included);
      return remaps;
    },
    {
      pause,
      cursor: (after, done, page) => {
        if (initialLoad !== undefined && !initialLoad.complete) {
          const pages = initialLoad.pages + (page.data.length > 0 ? 1 : 0);
          initialLoad = {
            pages,
            // Entries may change while loading. Never show 100% with a
            // next page still to read; finishing fixes the actual total.
            totalPages: done
              ? pages
              : initialLoad.totalPages === null
                ? null
                : Math.max(initialLoad.totalPages, pages + 1),
            complete: done,
          };
        }
        return {
          owner,
          key: 'entries',
          after,
          ...(initialLoad === undefined ? {} : {initialLoad}),
        };
      },
    }
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
  const ownerId = await bindToApi(db, api, owner);
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
    ownerId,
    key,
    after => api.getTagJunctionsAfter(tagId, after),
    async page => {
      checkOwner(ownerId, [...page.data, ...(page.included ?? [])]);
      const remaps = await adoptCreates(db, owner, [
        ...page.data,
        ...(page.included ?? []),
      ]);
      await putJunctions(db, owner, page.data, page.included);
      return remaps;
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
  const [tag, cursor] = await timed('idb', 'isTagSynced', () =>
    Promise.all([
      db.tags.get([owner, tagId]),
      db.cursors.get([owner, tagCursorKey(tagId)]),
    ])
  );
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
    const checked = async () => {
      try {
        return await task();
      } catch (error) {
        if (error instanceof PublicViewChangedError)
          await clearPublicOwner(db, owner);
        throw error;
      }
    };
    const run = () =>
      locks === undefined ? checked() : locks.request(lockName, checked);
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  };
  const syncAllToTheEnd = (): Promise<void> =>
    exclusive(() => syncAll(db, api, owner, () => tagSyncsWaiting > 0))
      .then(done => (done ? undefined : syncAllToTheEnd()))
      .catch((error: unknown) => {
        if (error instanceof PublicViewChangedError && error.restart)
          return syncAllToTheEnd();
        throw error;
      });
  // One flush at a time; one asked for while it runs runs again after it, so
  // a write queued meanwhile is sent.
  let flushing: Promise<void> | null = null;
  let bound = false;
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
        await exclusive(async () => {
          // Never another account's writes, queued under the same name.
          if (!bound) {
            await bindToApi(db, api, owner);
            bound = true;
          }
          await flushOutbox(db, writes, owner);
        });
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
