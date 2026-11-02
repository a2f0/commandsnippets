/**
 * What a queued write (`QueuedWrite`) names: the rows it changes, the ids
 * it refers to, the row it creates. Pure: no database, no API.
 */
import {type QueuedWrite, rowKey} from '../db/database';

export const TAG = 'Tag';
export const TEXT_ENTRY = 'TextEntry';
export const JUNCTION = 'TagTextEntryThroughModel';

/** The rows a write changes locally (`rowKey`s): pending until it is sent. */
export function rowsOf(owner: string, write: QueuedWrite): string[] {
  switch (write.kind) {
    case 'createTag':
    case 'keepTag':
    case 'renameTag':
    case 'setTagPublic':
    case 'deleteTag':
      return [rowKey(owner, TAG, write.tagId)];
    case 'reorderTags':
      return [rowKey(owner, TAG, write.top)];
    case 'createEntry':
    case 'updateEntry':
    case 'setEntryPublic':
    case 'deleteEntry':
    // Its count changed.
    case 'reuseEntry':
      return [rowKey(owner, TEXT_ENTRY, write.entryId)];
    // The tag and the entry too: their counts changed.
    case 'tagEntry':
    case 'untagEntry':
      return [
        rowKey(owner, JUNCTION, write.junctionId),
        rowKey(owner, TAG, write.tagId),
        rowKey(owner, TEXT_ENTRY, write.entryId),
      ];
    case 'reorderEntries':
      return [rowKey(owner, JUNCTION, write.top)];
    // A read holds no row: what a sync stores meanwhile stands too.
    case 'refreshTags':
    case 'refreshJunctions':
    case 'restoreTag':
    case 'restoreEntry':
    case 'restoreJunction':
      return [];
  }
}

/** The ids a write names, as `[type, id]`. */
export function idsOf(write: QueuedWrite): Array<[string, string]> {
  switch (write.kind) {
    case 'createTag':
    case 'keepTag':
    case 'renameTag':
    case 'setTagPublic':
    case 'deleteTag':
      return [[TAG, write.tagId]];
    case 'reorderTags':
      return [
        [TAG, write.top],
        [TAG, write.bottom],
      ];
    case 'createEntry':
    case 'updateEntry':
    case 'setEntryPublic':
    case 'deleteEntry':
    case 'reuseEntry':
      return [[TEXT_ENTRY, write.entryId]];
    case 'tagEntry':
    case 'untagEntry':
      return [
        [JUNCTION, write.junctionId],
        [TAG, write.tagId],
        [TEXT_ENTRY, write.entryId],
      ];
    case 'reorderEntries':
      return [
        [TAG, write.tagId],
        [JUNCTION, write.top],
        [JUNCTION, write.bottom],
      ];
    case 'refreshTags':
      return [];
    case 'refreshJunctions':
    case 'restoreTag':
      return [[TAG, write.tagId]];
    case 'restoreEntry':
      return [[TEXT_ENTRY, write.entryId]];
    case 'restoreJunction':
      return [
        [JUNCTION, write.junctionId],
        [TAG, write.tagId],
        [TEXT_ENTRY, write.entryId],
      ];
  }
}

/** The row a write creates, when it creates one: `[type, id]`. */
export function createdBy(write: QueuedWrite): [string, string] | null {
  switch (write.kind) {
    case 'createTag':
      return [TAG, write.tagId];
    case 'createEntry':
      return [TEXT_ENTRY, write.entryId];
    case 'tagEntry':
      return [JUNCTION, write.junctionId];
    default:
      return null;
  }
}

/** `write` with the id `from` (of a row of `type`) replaced by `to`. */
export function renamed(
  write: QueuedWrite,
  type: string,
  from: string,
  to: string
): QueuedWrite {
  const swap = (id: string) => (id === from ? to : id);
  switch (write.kind) {
    case 'createTag':
    case 'keepTag':
    case 'renameTag':
    case 'setTagPublic':
    case 'deleteTag':
      return type === TAG ? {...write, tagId: swap(write.tagId)} : write;
    case 'reorderTags':
      return type === TAG
        ? {...write, top: swap(write.top), bottom: swap(write.bottom)}
        : write;
    case 'createEntry':
    case 'updateEntry':
    case 'setEntryPublic':
    case 'deleteEntry':
    case 'reuseEntry':
      return type === TEXT_ENTRY
        ? {...write, entryId: swap(write.entryId)}
        : write;
    case 'tagEntry':
    case 'untagEntry':
      return {
        ...write,
        junctionId:
          type === JUNCTION ? swap(write.junctionId) : write.junctionId,
        tagId: type === TAG ? swap(write.tagId) : write.tagId,
        entryId: type === TEXT_ENTRY ? swap(write.entryId) : write.entryId,
      };
    case 'reorderEntries':
      return {
        ...write,
        tagId: type === TAG ? swap(write.tagId) : write.tagId,
        top: type === JUNCTION ? swap(write.top) : write.top,
        bottom: type === JUNCTION ? swap(write.bottom) : write.bottom,
      };
    // Reads name the API's ids only: nothing to rename.
    case 'refreshTags':
    case 'refreshJunctions':
    case 'restoreTag':
    case 'restoreEntry':
    case 'restoreJunction':
      return write;
  }
}

/** Whether `write` only reads (a restore, or a reorder's refresh). */
export const isRead = (write: QueuedWrite) =>
  write.kind === 'refreshTags' ||
  write.kind === 'refreshJunctions' ||
  write.kind === 'restoreTag' ||
  write.kind === 'restoreEntry' ||
  write.kind === 'restoreJunction';
