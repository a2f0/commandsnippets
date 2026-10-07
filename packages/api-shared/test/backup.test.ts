import {describe, expect, test} from 'bun:test';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupSchema,
  dataVersionDocumentSchema,
  dataVersionListDocumentSchema,
  dataVersionSchema,
  restoreResultSchema,
} from '../src/index';
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

describe('restore results', () => {
  test('count what the restore made', () => {
    const result = {
      data_version: 2,
      tags: 1,
      entries: 2,
      tags_entries: 3,
      entry_reuses: 0,
    };
    expect(parsed(restoreResultSchema, result)).toEqual(result);
    expect(
      failures(restoreResultSchema, {...result, entries: -1})
    ).toHaveLength(1);
    const {data_version: _, ...unversioned} = result;
    expect(failures(restoreResultSchema, unversioned)).toHaveLength(1);
    expect(
      failures(restoreResultSchema, {...result, data_version: 0})
    ).toHaveLength(1);
  });
});

describe('data versions', () => {
  const version = {
    type: 'DataVersion',
    id: '2',
    attributes: {
      version: 2,
      date_created: ts,
      active: true,
      origin: 'restore',
      backup_username: 'alice',
      backup_exported: ts,
      tag_count: 3,
      entry_count: 7,
    },
  };

  test('parse as the API renders them, losing nothing', () => {
    const initial = {
      ...version,
      id: '1',
      attributes: {
        ...version.attributes,
        version: 1,
        active: false,
        origin: 'initial',
        backup_username: null,
        backup_exported: null,
      },
    };
    const list = {data: [version, initial]};
    expect(parsed(dataVersionListDocumentSchema, list)).toEqual(list as never);
    expect(parsed(dataVersionDocumentSchema, {data: version})).toEqual({
      data: version,
    } as never);
  });

  test('refuse another origin, or a version that is not a positive number', () => {
    expect(
      failures(dataVersionSchema, {
        ...version,
        attributes: {...version.attributes, origin: 'copy'},
      })
    ).toHaveLength(1);
    expect(
      failures(dataVersionSchema, {
        ...version,
        attributes: {...version.attributes, version: 0},
      })
    ).toHaveLength(1);
    expect(
      failures(dataVersionDocumentSchema, {data: version, included: [version]})
    ).toHaveLength(1);
  });
});
