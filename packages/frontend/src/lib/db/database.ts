/**
 * The signed-in user's data in IndexedDB (Dexie): their tags, entries and
 * junctions as the API renders them (api-shared's resources), and the
 * cursors the sync (`lib/sync/`) keeps. One database per environment and
 * user; signing out deletes it.
 */
import type {
  Tag,
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';
import {Dexie, type Table} from 'dexie';

/**
 * Where a sync is up to: a keyset cursor (api-shared's `cursorOf`) in a list
 * in revision order. The master cursors are `tags` and `entries`, and each
 * tag has one of its junctions (`tag:<id>`), with the tag revision they were
 * synced through.
 */
export interface SyncCursor {
  key: string;
  after: string;
  /** For a tag: its revision (`date_updated`) when its sync ended. */
  revision?: string;
}

export class CommandsnippetsDatabase extends Dexie {
  tags!: Table<Tag, string>;
  entries!: Table<TextEntry, string>;
  /** Deleted ones too (`is_deleted`), as the tags' junction lists show them. */
  junctions!: Table<TagTextEntry, string>;
  cursors!: Table<SyncCursor, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      tags: 'id',
      entries: 'id',
      junctions:
        'id, relationships.tag.data.id, relationships.text_entry.data.id',
      cursors: 'key',
    });
  }
}

/** The database of `username`'s data in `environment`. */
export const databaseName = (environment: string, username: string) =>
  `commandsnippets-${environment}-${username}`;

/** The key of tag `tagId`'s cursor. */
export const tagCursorKey = (tagId: string) => `tag:${tagId}`;
