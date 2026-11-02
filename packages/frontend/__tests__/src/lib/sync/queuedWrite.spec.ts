import {describe, expect, it} from 'vitest';

import type {QueuedWrite} from '../../../../src/lib/db/database';
import {
  createdBy,
  idsOf,
  isRead,
  JUNCTION,
  renamed,
  rowsOf,
  TAG,
  TEXT_ENTRY,
} from '../../../../src/lib/sync/queuedWrite';

const tagging: QueuedWrite = {
  kind: 'tagEntry',
  junctionId: 'local-j',
  tagId: 'local-t',
  entryId: '3',
};

describe('rowsOf', () => {
  it('holds the rows a write changes, counts included', () => {
    expect(rowsOf('ann', tagging)).toEqual([
      `ann|${JUNCTION}|local-j`,
      `ann|${TAG}|local-t`,
      `ann|${TEXT_ENTRY}|3`,
    ]);
    expect(
      rowsOf('ann', {kind: 'reuseEntry', entryId: '3', reuseId: 'r'})
    ).toEqual([`ann|${TEXT_ENTRY}|3`]);
  });

  it('holds only the row a reorder moved', () => {
    expect(rowsOf('ann', {kind: 'reorderTags', top: '1', bottom: '2'})).toEqual(
      [`ann|${TAG}|1`]
    );
  });

  it('holds no row for a read', () => {
    expect(rowsOf('ann', {kind: 'refreshTags'})).toEqual([]);
    expect(rowsOf('ann', {kind: 'restoreEntry', entryId: '3'})).toEqual([]);
  });
});

describe('idsOf', () => {
  it('names every id a write refers to', () => {
    expect(
      idsOf({kind: 'reorderEntries', tagId: '1', top: 'a', bottom: 'b'})
    ).toEqual([
      [TAG, '1'],
      [JUNCTION, 'a'],
      [JUNCTION, 'b'],
    ]);
    expect(idsOf({kind: 'refreshTags'})).toEqual([]);
    expect(idsOf({kind: 'refreshJunctions', tagId: '1'})).toEqual([[TAG, '1']]);
  });
});

describe('createdBy', () => {
  it('names the row a create makes', () => {
    expect(createdBy({kind: 'createTag', tagId: 'local-t', name: 'n'})).toEqual(
      [TAG, 'local-t']
    );
    expect(createdBy(tagging)).toEqual([JUNCTION, 'local-j']);
  });

  it('is null for a write that creates nothing', () => {
    expect(createdBy({kind: 'deleteTag', tagId: '1'})).toBeNull();
  });
});

describe('renamed', () => {
  it('replaces the id of the type named, and only it', () => {
    expect(renamed(tagging, TAG, 'local-t', '9')).toEqual({
      ...tagging,
      tagId: '9',
    });
    expect(renamed(tagging, TEXT_ENTRY, 'local-t', '9')).toEqual(tagging);
  });

  it('leaves a read as it is', () => {
    const read: QueuedWrite = {kind: 'restoreTag', tagId: 'local-t'};
    expect(renamed(read, TAG, 'local-t', '9')).toBe(read);
  });
});

describe('isRead', () => {
  it('tells reads from writes', () => {
    expect(isRead({kind: 'refreshJunctions', tagId: '1'})).toBe(true);
    expect(
      isRead({
        kind: 'restoreJunction',
        junctionId: '5',
        tagId: '1',
        entryId: '3',
      })
    ).toBe(true);
    expect(isRead(tagging)).toBe(false);
  });
});
