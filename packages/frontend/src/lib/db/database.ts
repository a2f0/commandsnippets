/**
 * The signed-in user's IndexedDB database (Dexie): tags, entries and
 * junctions as the API renders them (api-shared's resources), and the
 * cursors the sync (`lib/sync/`) keeps. One database per environment and
 * signed-in user; signing out deletes it.
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

/** A resource as stored: keyed by the username of the user whose it is. */
export type Stored<R> = R & {owner: string};

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
}

export class CommandsnippetsDatabase extends Dexie {
  tags!: Table<Stored<Tag>, RowKey>;
  entries!: Table<Stored<TextEntry>, RowKey>;
  /** Deleted ones too (`is_deleted`), as the tags' junction lists show them. */
  junctions!: Table<Stored<TagTextEntry>, RowKey>;
  cursors!: Table<SyncCursor, RowKey>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      tags: '[owner+id], owner',
      entries: '[owner+id], owner',
      junctions:
        '[owner+id], owner, [owner+relationships.tag.data.id], [owner+relationships.text_entry.data.id]',
      cursors: '[owner+key]',
    });
  }
}

/** The database of `username`'s data in `environment`. */
export const databaseName = (environment: string, username: string) =>
  `commandsnippets-${environment}-${username}`;

/** The key of tag `tagId`'s cursor. */
export const tagCursorKey = (tagId: string) => `tag:${tagId}`;
