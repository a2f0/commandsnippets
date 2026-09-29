import type {
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {CommandsnippetsDatabase} from '../../../../src/lib/db/database';
import {putEntries, putNewer} from '../../../../src/lib/sync/store';

const owner = {user: {data: {type: 'User', id: '1'}}} as const;

const entry = (
  id: string,
  date_updated: string,
  junctionIds: string[]
): TextEntry => ({
  type: 'TextEntry',
  id,
  attributes: {
    body: `body-${id}`,
    subject: `subject-${id}`,
    date_updated,
    date_created: '2020-01-01T00:00:00',
    reused_count: 0,
    is_deleted: false,
    tag_count: junctionIds.length,
  },
  relationships: {
    ...owner,
    text_entry_to_tag: {
      data: junctionIds.map(junctionId => ({
        type: 'TagTextEntryThroughModel',
        id: junctionId,
      })),
      meta: {count: junctionIds.length},
    },
  },
});

const junction = (
  id: string,
  entryId: string,
  date_updated = '2020-01-01T00:00:00'
): TagTextEntry => ({
  type: 'TagTextEntryThroughModel',
  id,
  attributes: {
    order: Number(id),
    date_updated,
    date_created: '2020-01-01T00:00:00',
    is_deleted: false,
  },
  relationships: {
    tag: {data: {type: 'Tag', id: '1'}},
    text_entry: {data: {type: 'TextEntry', id: entryId}},
    ...owner,
  },
});

let db: CommandsnippetsDatabase;
let databases = 0;
beforeEach(() => {
  databases += 1;
  db = new CommandsnippetsDatabase(`store-spec-${databases}`);
});
afterEach(() => db.delete());

describe('putNewer', () => {
  it('stores each resource unless a newer revision is stored', async () => {
    await db.entries.bulkPut([
      entry('1', '2024-01-01T00:00:00.5', []),
      entry('2', '2024-01-01T00:00:00', []),
    ]);
    const stored = await putNewer(db.entries, [
      // Older than the stored one: `.5` is past the whole second.
      entry('1', '2024-01-01T00:00:00', []),
      entry('2', '2024-01-01T00:00:01', []),
      // Listed twice: the newer copy.
      entry('3', '2024-01-01T00:00:02', []),
      entry('3', '2024-01-01T00:00:01', []),
    ]);
    expect(stored.map(({id}) => id)).toEqual(['2', '3']);
    expect((await db.entries.get('1'))?.attributes.date_updated).toBe(
      '2024-01-01T00:00:00.5'
    );
    expect((await db.entries.get('3'))?.attributes.date_updated).toBe(
      '2024-01-01T00:00:02'
    );
  });
});

describe('putEntries', () => {
  it("deletes the junctions an entry's listing leaves out", async () => {
    await db.junctions.bulkPut([junction('1', '1'), junction('2', '1')]);
    await putEntries(db, [entry('1', '2024-01-01T00:00:00', ['2'])]);
    expect((await db.junctions.get('1'))?.attributes.is_deleted).toBe(true);
    expect((await db.junctions.get('2'))?.attributes.is_deleted).toBe(false);
  });

  it("leaves the junctions alone when the entry's copy is older", async () => {
    await db.entries.put(entry('1', '2024-01-02T00:00:00', ['1']));
    await db.junctions.put(junction('1', '1'));
    await putEntries(db, [entry('1', '2024-01-01T00:00:00', [])]);
    expect((await db.junctions.get('1'))?.attributes.is_deleted).toBe(false);
  });

  it('stores the junctions read with the entries', async () => {
    await putEntries(
      db,
      [entry('1', '2024-01-01T00:00:00', ['5'])],
      [junction('5', '1', '2024-01-01T00:00:00')]
    );
    expect((await db.junctions.get('5'))?.attributes.is_deleted).toBe(false);
  });
});
