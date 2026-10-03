/**
 * The signed-in user's IndexedDB database (Dexie): tags, entries and
 * junctions as the API renders them (api-shared's resources), the cursors the
 * sync (`lib/sync/`) keeps, and the writes queued for the API (`outbox`,
 * `lib/sync/outbox.ts`). One database per environment and signed-in user;
 * signing out deletes it.
 *
 * Every row is keyed by its owner (`[owner+id]`, the owner's username): the
 * signed-in user's own data, and for staff the data of the users whose data
 * they read (read-only), sit side by side, and every read names whose it is.
 */
import type {
  Tag,
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';
import {Dexie, type Table} from 'dexie';

/**
 * A resource as stored: keyed by the username of the user whose it is. A
 * row made here keeps its local id (`localId`) once the API's replaces it,
 * so the UI keys it the same throughout (an editor open on it stays open).
 */
export type Stored<R> = R & {owner: string; localId?: string | undefined};

/** The key the UI gives a stored row: its local id, if it had one. */
export const keyOfRow = (row: {id: string; localId?: string | undefined}) =>
  row.localId ?? row.id;

/** A row's primary key: its owner's username, then its id (or cursor key). */
export type RowKey = [owner: string, id: string];

/**
 * Where a sync is up to: a keyset cursor (api-shared's `cursorOf`) in a list
 * in revision order. The master cursors are `tags` and `entries`, and each
 * tag has one of its junctions (`tag:<id>`), with the tag revision they were
 * synced through. Each owner's data has its own.
 */
export interface SyncCursor {
  owner: string;
  key: string;
  after: string;
  /** For a tag: its revision (`date_updated`) when its sync ended. */
  revision?: string;
  /** Entry pages saved during the first collection load, across retries. */
  initialLoad?: {
    pages: number;
    totalPages: number | null;
    complete: boolean;
  };
}

/**
 * A write the user made, stored at once and queued for the API, which it
 * reaches in `seq` order (`lib/sync/outbox.ts`). Ids in it can be local ones
 * (`local-...`) for rows not created on the API yet.
 */
export type QueuedWrite =
  | {kind: 'createTag'; tagId: string; name: string}
  // A tag the user has, asked for again (a create of its name): kept, and
  // brought back if deleted, by id (never a new tag of the name).
  | {kind: 'keepTag'; tagId: string}
  | {kind: 'renameTag'; tagId: string; name: string}
  | {kind: 'deleteTag'; tagId: string}
  | {kind: 'reorderTags'; top: string; bottom: string}
  | {kind: 'createEntry'; entryId: string; subject: string; body: string}
  | {kind: 'updateEntry'; entryId: string; subject: string; body: string}
  | {kind: 'deleteEntry'; entryId: string}
  | {kind: 'tagEntry'; junctionId: string; tagId: string; entryId: string}
  | {kind: 'untagEntry'; junctionId: string; tagId: string; entryId: string}
  | {kind: 'reorderEntries'; tagId: string; top: string; bottom: string}
  // A reorder the API has made, in its place in the queue: the rows it
  // ranks (the tags, or a tag's junctions) are read again, which a sync left
  // as they were while it was queued. Retried alone, so a reorder is sent
  // once.
  | {kind: 'refreshTags'}
  | {kind: 'refreshJunctions'; tagId: string}
  // Put a row back as the API holds it, after a write to it was refused.
  | {kind: 'restoreTag'; tagId: string}
  | {kind: 'restoreEntry'; entryId: string}
  | {
      kind: 'restoreJunction';
      junctionId: string;
      tagId: string;
      entryId: string;
    };

export interface OutboxRow {
  /** Its place in the queue. */
  seq?: number;
  owner: string;
  /** When the user made it (the API's datetime form): last writer wins. */
  made: string;
  /**
   * Its id, sent with every attempt (`Client-Write-Id`): the API counts a
   * retry as made when the write first arrived.
   */
  writeId: string;
  write: QueuedWrite;
  /**
   * The rows it changed locally (`rowKey`): a sync leaves them as they are
   * until it reaches the API, so it never undoes the user's write.
   */
  rows: string[];
}

/** The outbox's key of a row: its owner, type and id. */
export const rowKey = (owner: string, type: string, id: string) =>
  `${owner}|${type}|${id}`;

export class CommandsnippetsDatabase extends Dexie {
  tags!: Table<Stored<Tag>, RowKey>;
  entries!: Table<Stored<TextEntry>, RowKey>;
  /** Deleted ones too (`is_deleted`), as the tags' junction lists show them. */
  junctions!: Table<Stored<TagTextEntry>, RowKey>;
  cursors!: Table<SyncCursor, RowKey>;
  outbox!: Table<OutboxRow, number>;

  constructor(name: string) {
    super(name);
    // Version 2 added the outbox (a version 1 database gets it in place).
    this.version(2).stores({
      tags: '[owner+id], owner',
      entries: '[owner+id], owner',
      junctions:
        '[owner+id], owner, [owner+relationships.tag.data.id], [owner+relationships.text_entry.data.id]',
      cursors: '[owner+key]',
      outbox: '++seq, owner, *rows',
    });
  }
}

/** The database of `username`'s data in `environment`. */
export const databaseName = (environment: string, username: string) =>
  `commandsnippets-${environment}-${username}`;

/**
 * The key (in `cursors`) of the id of the account whose data an owner's is
 * (`bindOwner`).
 */
export const OWNER_ID_KEY = 'user';

/** The key of tag `tagId`'s cursor. */
export const tagCursorKey = (tagId: string) => `tag:${tagId}`;
