/**
 * The sync between the API and the signed-in user's IndexedDB database
 * (`lib/db/database.ts`): keyset reads (api-shared's `cursor.ts`) from
 * cursors the database keeps, so a sync resumes where the last one stopped,
 * and a first one (no cursors: a fresh sign-in) reads everything.
 *
 * - `syncAll` syncs the whole collection: the tags changed since the `tags`
 *   cursor, then the entries (with their junctions) changed since the
 *   `entries` cursor. Each page is stored with the cursor past it in one
 *   transaction. As it goes, it gives each tag a cursor of its own: a tag is
 *   whole once the pages have listed as many of its junctions as its
 *   `entry_count`, and every tag is at the end. A tag's cursor is the newest
 *   junction revision there was when the sync began (every later change
 *   gets a newer one), with the tag's revision the tags read listed.
 * - `syncTag` syncs one tag: its junctions changed since its cursor (deleted
 *   ones too: entries that left it), with their entries. A tag is synced
 *   through its revision (the API advances it whenever anything in it
 *   changes) when its cursor holds that revision (`isTagSynced`).
 *
 * Syncs run one at a time, in this tab and across tabs (a Web Lock, where
 * the browser has them), so each response is stored in the order it was
 * read: a response never undoes what a later-read one stored.
 */
import {CURSOR_START, cursorOf} from '@commandsnippets/api-shared/cursor';
import type {
  IncludedResource,
  TagCursorListDocument,
  TagTextEntry,
  TagTextEntryCursorListDocument,
  TagTextEntryListDocument,
  TextEntryCursorListDocument,
} from '@commandsnippets/api-shared/responses';
import {
  type CommandsnippetsDatabase,
  type SyncCursor,
  tagCursorKey,
} from '../db/database';
import {putEntries, putJunctions, putTags} from './store';

/** The API reads a sync makes (`apiClient`'s). */
export interface SyncApi {
  getTagsAfter(after: string): Promise<TagCursorListDocument>;
  getEntriesAfter(after: string): Promise<TextEntryCursorListDocument>;
  getTagJunctionsAfter(
    tagId: string,
    after: string
  ): Promise<TagTextEntryCursorListDocument>;
  getNewestJunction(): Promise<TagTextEntryListDocument>;
}

type Page = {
  data: ReadonlyArray<{id: string; attributes: {date_updated: string}}>;
  links: {next: string | null};
};

/**
 * Read every page after the stored cursor `key` (from the start without
 * one), storing each (`store`) with the cursor past it in one transaction.
 */
async function readAfter<P extends Page>(
  db: CommandsnippetsDatabase,
  key: string,
  read: (after: string) => Promise<P>,
  store: (page: P) => Promise<void>,
  cursor: (after: string, done: boolean) => SyncCursor = after => ({
    key,
    after,
  })
): Promise<void> {
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
      return;
    }
  }
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

/** Give tag `tagId` its cursor at `mark`, with its revision now stored. */
async function markTagSynced(
  db: CommandsnippetsDatabase,
  tagId: string,
  mark: string
): Promise<void> {
  const tag = await db.tags.get(tagId);
  if (tag !== undefined) {
    await db.cursors.put({
      key: tagCursorKey(tagId),
      after: mark,
      revision: tag.attributes.date_updated,
    });
  }
}

async function syncAll(
  db: CommandsnippetsDatabase,
  api: SyncApi
): Promise<void> {
  const mark = await junctionsMark(api);
  await readAfter(
    db,
    'tags',
    after => api.getTagsAfter(after),
    page => putTags(db, page.data)
  );

  // Each tag's junctions the entries pages list, for the tags without a
  // cursor: one is whole once they number its `entry_count`.
  const listed = new Map<string, Set<string>>();
  const unsynced = new Set<string>();
  for (const tagId of await db.tags.toCollection().primaryKeys()) {
    if ((await db.cursors.get(tagCursorKey(tagId))) === undefined) {
      unsynced.add(tagId);
    }
  }
  await readAfter(
    db,
    'entries',
    after => api.getEntriesAfter(after),
    async page => {
      await putEntries(db, page.data, page.included);
      for (const junction of junctionsOf(page.included)) {
        const tagId = junction.relationships.tag.data.id;
        if (unsynced.has(tagId)) {
          const ids = listed.get(tagId) ?? new Set();
          ids.add(junction.id);
          listed.set(tagId, ids);
        }
      }
      for (const tagId of [...unsynced]) {
        const tag = await db.tags.get(tagId);
        if (
          tag !== undefined &&
          (listed.get(tagId)?.size ?? 0) >= tag.attributes.entry_count
        ) {
          await markTagSynced(db, tagId, mark);
          unsynced.delete(tagId);
        }
      }
    }
  );
  // Every change there was when the sync began is stored now.
  await db.transaction('rw', [db.tags, db.cursors], async () => {
    for (const tagId of await db.tags.toCollection().primaryKeys()) {
      await markTagSynced(db, tagId, mark);
    }
  });
}

const junctionsOf = (included: readonly IncludedResource[] = []) =>
  included.filter(
    (resource): resource is TagTextEntry =>
      resource.type === 'TagTextEntryThroughModel'
  );

async function syncTag(
  db: CommandsnippetsDatabase,
  api: SyncApi,
  tagId: string
): Promise<void> {
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
    page => putJunctions(db, page.data, page.included),
    (after, done) => ({
      key,
      after,
      ...(done ? {revision} : held === undefined ? {} : {revision: held}),
    })
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
 * The syncs of `db` from `api`, run one at a time: in this tab in the order
 * they are asked for, and across tabs by the Web Lock `lockName`.
 */
export function createSyncEngine(
  db: CommandsnippetsDatabase,
  api: SyncApi,
  lockName: string
): SyncEngine {
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = (task: () => Promise<void>): Promise<void> => {
    const locks = globalThis.navigator?.locks;
    const run = () =>
      locks === undefined ? task() : locks.request(lockName, task);
    const result = queue.then(run, run);
    queue = result.catch(() => undefined);
    return result;
  };
  return {
    syncAll: () => exclusive(() => syncAll(db, api)),
    syncTag: tagId => exclusive(() => syncTag(db, api, tagId)),
  };
}
