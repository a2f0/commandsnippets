import type {
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  CommandsnippetsDatabase,
  type RowKey,
} from '../../../../src/lib/db/database';
import {
  checkOwner,
  ForeignDataError,
  putEntries,
  putJunctions,
  putNewer,
} from '../../../../src/lib/sync/store';

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

/** Whose rows the database holds (the store keys every row by its owner). */
const OWNER = 'test';
const key = (id: string): RowKey => [OWNER, id];
const own = <R>(resource: R) => ({...resource, owner: OWNER});

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
      own(entry('1', '2024-01-01T00:00:00.5', [])),
      own(entry('2', '2024-01-01T00:00:00', [])),
    ]);
    const stored = await putNewer(db, db.entries, OWNER, [
      // Older than the stored one: `.5` is past the whole second.
      entry('1', '2024-01-01T00:00:00', []),
      entry('2', '2024-01-01T00:00:01', []),
      // Listed twice: the newer copy.
      entry('3', '2024-01-01T00:00:02', []),
      entry('3', '2024-01-01T00:00:01', []),
    ]);
    expect(stored.map(({id}) => id)).toEqual(['2', '3']);
    expect((await db.entries.get(key('1')))?.attributes.date_updated).toBe(
      '2024-01-01T00:00:00.5'
    );
    expect((await db.entries.get(key('3')))?.attributes.date_updated).toBe(
      '2024-01-01T00:00:02'
    );
  });
});

describe('putEntries', () => {
  it("deletes the junctions an entry's listing leaves out", async () => {
    await db.junctions.bulkPut([
      own(junction('1', '1')),
      own(junction('2', '1')),
    ]);
    await putEntries(db, OWNER, [entry('1', '2024-01-01T00:00:00', ['2'])]);
    expect((await db.junctions.get(key('1')))?.attributes.is_deleted).toBe(
      true
    );
    expect((await db.junctions.get(key('2')))?.attributes.is_deleted).toBe(
      false
    );
  });

  it("leaves the junctions alone when the entry's copy is older", async () => {
    await db.entries.put(own(entry('1', '2024-01-02T00:00:00', ['1'])));
    await db.junctions.put(own(junction('1', '1')));
    await putEntries(db, OWNER, [entry('1', '2024-01-01T00:00:00', [])]);
    expect((await db.junctions.get(key('1')))?.attributes.is_deleted).toBe(
      false
    );
  });

  it('stores the junctions read with the entries', async () => {
    await putEntries(
      db,
      OWNER,
      [entry('1', '2024-01-01T00:00:00', ['5'])],
      [junction('5', '1', '2024-01-01T00:00:00')]
    );
    expect((await db.junctions.get(key('5')))?.attributes.is_deleted).toBe(
      false
    );
  });

  it('never brings back a junction with an older copy of its entry', async () => {
    // Entry 1's newer listing left junction 1 out: deleted here.
    await db.junctions.put(own(junction('1', '1')));
    await putEntries(db, OWNER, [entry('1', '2024-01-02T00:00:00', [])]);
    expect((await db.junctions.get(key('1')))?.attributes.is_deleted).toBe(
      true
    );

    // An older response lists it, with the revision it had then.
    await putEntries(
      db,
      OWNER,
      [entry('1', '2024-01-01T00:00:00', ['1'])],
      [junction('1', '1')]
    );
    expect((await db.junctions.get(key('1')))?.attributes.is_deleted).toBe(
      true
    );
    // A tag's list with that revision, active, does not either.
    await putJunctions(db, OWNER, [junction('1', '1')]);
    expect((await db.junctions.get(key('1')))?.attributes.is_deleted).toBe(
      true
    );
    // Restoring it gives it a newer revision, which is stored.
    await putJunctions(db, OWNER, [junction('1', '1', '2024-01-03T00:00:00')]);
    expect((await db.junctions.get(key('1')))?.attributes.is_deleted).toBe(
      false
    );
  });
});

describe('a row with a write queued', () => {
  const queue = (rows: string[]) =>
    db.outbox.add({
      owner: OWNER,
      made: '2024-01-01T00:00:00.000000',
      write: {kind: 'deleteEntry', entryId: '1'},
      rows,
    });

  it('is left as it is by a newer copy, until the write is sent', async () => {
    await db.entries.put(own(entry('1', '2024-01-01T00:00:00', [])));
    await queue([`${OWNER}|TextEntry|1`]);

    await putEntries(db, OWNER, [entry('1', '2024-01-05T00:00:00', [])]);
    expect((await db.entries.get(key('1')))?.attributes.date_updated).toBe(
      '2024-01-01T00:00:00'
    );

    await db.outbox.clear();
    await putEntries(db, OWNER, [entry('1', '2024-01-05T00:00:00', [])]);
    expect((await db.entries.get(key('1')))?.attributes.date_updated).toBe(
      '2024-01-05T00:00:00'
    );
  });

  it("keeps a junction an entry's listing leaves out while its tagging is queued", async () => {
    await db.junctions.put(own(junction('local-1', '1')));
    await queue([`${OWNER}|TagTextEntryThroughModel|local-1`]);

    await putEntries(db, OWNER, [entry('1', '2024-01-01T00:00:00', [])]);
    expect(
      (await db.junctions.get(key('local-1')))?.attributes.is_deleted
    ).toBe(false);
  });
});

describe("a write's answer (force)", () => {
  it('replaces the row whatever its revision', async () => {
    await db.entries.put(own(entry('1', '2099-01-01T00:00:00', [])));

    await putEntries(
      db,
      OWNER,
      [entry('1', '2024-01-01T00:00:00', [])],
      [],
      true
    );

    expect((await db.entries.get(key('1')))?.attributes.date_updated).toBe(
      '2024-01-01T00:00:00'
    );
  });
});

describe("each owner's rows", () => {
  it('are kept apart, however their ids compare', async () => {
    await putEntries(
      db,
      'alice',
      [entry('1', '2024-01-01T00:00:00', ['1'])],
      [junction('1', '1')]
    );
    await putEntries(db, OWNER, [entry('1', '2024-01-02T00:00:00', [])]);

    // The owner's newer listing of entry 1 leaves alice's junction alone.
    expect(
      (await db.junctions.get(['alice', '1']))?.attributes.is_deleted
    ).toBe(false);
    expect(
      (await db.entries.get(['alice', '1']))?.attributes.date_updated
    ).toBe('2024-01-01T00:00:00');
    expect((await db.entries.get(key('1')))?.attributes.date_updated).toBe(
      '2024-01-02T00:00:00'
    );
    expect(await db.entries.where('owner').equals('alice').count()).toBe(1);
  });
});

describe('checkOwner', () => {
  it("refuses another user's resource", () => {
    expect(() => checkOwner('1', [junction('1', '1')])).not.toThrow();
    const theirs = {
      ...junction('2', '1'),
      relationships: {
        ...junction('2', '1').relationships,
        user: {data: {type: 'User', id: '2'}},
      },
    } as const;
    expect(() => checkOwner('1', [theirs])).toThrow(ForeignDataError);
  });
});
