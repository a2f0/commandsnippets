import {describe, expect, test} from 'bun:test';
import {BACKUP_FORMAT, BACKUP_VERSION, backupSchema} from '../src/index';
import {failures, parsed} from './support';

const ts = '2024-01-01T12:34:56.123456';
const backup = {
  format: 'commandsnippets-backup',
  version: 1,
  date_exported: ts,
  user: {id: '1', username: 'dan'},
  tags: [
    {
      id: '2',
      name: 'postgres',
      order: 0,
      is_public: false,
      date_created: '2024-01-01T12:34:56',
      date_updated: ts,
    },
  ],
  entries: [
    {
      id: '6',
      subject: 'list databases',
      body: '\\l',
      is_public: true,
      date_created: ts,
      date_updated: ts,
    },
  ],
  tags_entries: [
    {
      id: '5',
      tag_id: '2',
      text_entry_id: '6',
      order: 3,
      date_created: ts,
      date_updated: ts,
    },
  ],
  entry_reuses: [{id: '9', text_entry_id: '6', date_created: ts}],
};

describe('backups', () => {
  test('name their format and version', () => {
    expect(BACKUP_FORMAT).toBe('commandsnippets-backup');
    expect(BACKUP_VERSION).toBe(1);
  });

  test('parse as the API renders them, losing nothing', () => {
    expect(parsed(backupSchema, backup)).toEqual(backup as never);
    expect(
      parsed(backupSchema, {
        ...backup,
        tags: [],
        entries: [],
        tags_entries: [],
        entry_reuses: [],
      }).tags
    ).toEqual([]);
  });

  test('refuse another format or version', () => {
    expect(failures(backupSchema, {...backup, format: 'other'})).toHaveLength(
      1
    );
    expect(failures(backupSchema, {...backup, version: 2})).toHaveLength(1);
  });

  test('refuse ids that are not database ids', () => {
    expect(
      failures(backupSchema, {
        ...backup,
        tags_entries: [{...backup.tags_entries[0], tag_id: 2}],
      })
    ).toHaveLength(1);
    expect(
      failures(backupSchema, {
        ...backup,
        entries: [{...backup.entries[0], id: 'local-1'}],
      })
    ).toHaveLength(1);
  });

  test('refuse a missing collection', () => {
    const {entry_reuses: _, ...withoutReuses} = backup;
    expect(failures(backupSchema, withoutReuses)).toHaveLength(1);
  });
});
