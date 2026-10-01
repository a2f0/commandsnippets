/**
 * The user-owned tables behind the resources: what the shared viewset
 * behavior needs to scope reads to their owner, check ownership, and stamp
 * revisions.
 */
import type {SQL} from 'drizzle-orm';
import type {SQLiteColumn, SQLiteTable} from 'drizzle-orm/sqlite-core';
import {entryReuses, tags, tagsEntries, textEntries} from '../db/schema';
import {revision} from '../lib/revision';
import {
  TAG,
  TAG_TEXT_ENTRY,
  TEXT_ENTRY,
  TEXT_ENTRY_REUSED,
} from './resourceTypes';

export interface OwnedResource {
  type: string;
  table: SQLiteTable;
  id: SQLiteColumn;
  /** The owning user's column. */
  userId: SQLiteColumn;
}

/**
 * An owned resource whose rows carry a `date_updated` revision, and when a
 * client last wrote them (`client_updated`, resources/lww.ts).
 */
export interface RevisedResource extends OwnedResource {
  dateUpdated: SQLiteColumn;
  clientUpdated: SQLiteColumn;
}

export const tagResource = {
  type: TAG,
  table: tags,
  id: tags.id,
  userId: tags.user_id,
  dateUpdated: tags.date_updated,
  clientUpdated: tags.client_updated,
} satisfies RevisedResource;

export const textEntryResource = {
  type: TEXT_ENTRY,
  table: textEntries,
  id: textEntries.id,
  userId: textEntries.user_id,
  dateUpdated: textEntries.date_updated,
  clientUpdated: textEntries.client_updated,
} satisfies RevisedResource;

export const tagTextEntryResource = {
  type: TAG_TEXT_ENTRY,
  table: tagsEntries,
  id: tagsEntries.id,
  userId: tagsEntries.user_id,
  dateUpdated: tagsEntries.date_updated,
  clientUpdated: tagsEntries.client_updated,
} satisfies RevisedResource;

export const textEntryReusedResource = {
  type: TEXT_ENTRY_REUSED,
  table: entryReuses,
  id: entryReuses.id,
  userId: entryReuses.user_id,
} satisfies OwnedResource;

/** The next `date_updated` for `ownerId`'s rows (see lib/revision.ts). */
export function nextRevision(resource: RevisedResource, ownerId: number): SQL {
  return revision(
    resource.table,
    resource.dateUpdated,
    resource.userId,
    ownerId
  );
}
