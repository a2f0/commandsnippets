import {Dexie} from 'dexie';
import {afterEach, describe, expect, it} from 'vitest';

import {CommandsnippetsDatabase} from '../../../../src/lib/db/database';

const NAME = 'database-spec';

afterEach(() => Dexie.delete(NAME));

describe('the database', () => {
  it('upgrades a version 1 database in place, adding the outbox', async () => {
    // As the app before the write queue made it.
    const before = new Dexie(NAME);
    before.version(1).stores({
      tags: '[owner+id], owner',
      entries: '[owner+id], owner',
      junctions:
        '[owner+id], owner, [owner+relationships.tag.data.id], [owner+relationships.text_entry.data.id]',
      cursors: '[owner+key]',
    });
    await before.table('tags').put({owner: 'test', id: '1', type: 'Tag'});
    await before.table('cursors').put({owner: 'test', key: 'tags', after: 'x'});
    before.close();

    const db = new CommandsnippetsDatabase(NAME);

    expect(await db.tags.get(['test', '1'])).toMatchObject({id: '1'});
    expect(await db.cursors.count()).toBe(1);
    await db.outbox.add({
      owner: 'test',
      made: '2026-01-01T00:00:00.000000',
      writeId: 'write-1',
      write: {kind: 'deleteTag', tagId: '1'},
      rows: ['test|Tag|1'],
    });
    expect(await db.outbox.where('rows').equals('test|Tag|1').count()).toBe(1);
    db.close();
  });
});
