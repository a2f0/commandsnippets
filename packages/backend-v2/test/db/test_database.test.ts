import {CLIENT_WRITE_ID_HEADER} from '@commandsnippets/api-shared';
import {sql} from 'drizzle-orm';
import {describe, expect, it} from 'vitest';
import {adminAuditLog, tagClientIds} from '../../src/db/schema';
import {now} from '../../src/lib/clock';
import {
  db,
  json,
  setUpBase,
  textEntryFactory,
  textEntryReusedFactory,
  userFactory,
} from '../helpers';

// test/setup.ts: each test starts from an empty, fully migrated database,
// whatever the test before it left. These tests run in order, each reading
// what the one before it left.

/**
 * The tables that hold rows (or none): every one but D1's own and the
 * migrations' record.
 */
async function tables(withRows: boolean): Promise<string[]> {
  const names = await db().all<{name: string}>(
    sql.raw(`SELECT name FROM sqlite_master WHERE type = 'table'
      AND name NOT IN ('d1_migrations', 'sqlite_sequence')
      AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY name`)
  );
  const found: string[] = [];
  for (const {name} of names) {
    const [row] = await db().all<{rows: number}>(
      sql.raw(`SELECT COUNT(*) AS rows FROM "${name}"`)
    );
    if ((row?.rows ?? 0) > 0 === withRows) {
      found.push(name);
    }
  }
  return found;
}

const sequences = async () =>
  (
    await db().all<{name: string}>(
      sql`SELECT name FROM sqlite_sequence ORDER BY name`
    )
  ).map(({name}) => name);

const schema = () =>
  db().all(sql`SELECT type, name, sql FROM sqlite_master ORDER BY type, name`);

/** The schema as the second test found it: as migrated. */
let migrated: unknown[] = [];

describe('the test database', () => {
  it('is written to by a test: every table, two data versions', async () => {
    const {user1, user1Client: client} = await setUpBase();
    // A restore leaves the rows of the account's first version, which is no
    // longer active, so they may not be deleted one by one.
    const backup = await json(await client.get('/api/v1/user/backup'));
    expect((await client.post('/api/v1/user/restore', backup)).status).toBe(
      200
    );
    client.dataVersion = 2;
    const tagged = await client.request(
      'POST',
      '/api/v1/tags',
      {data: {type: 'Tag', attributes: {name: 'written'}}},
      {[CLIENT_WRITE_ID_HEADER]: 'write-1'}
    );
    expect(tagged.status).toBe(201);
    await db()
      .insert(tagClientIds)
      .values({
        user_id: user1.id,
        version: 2,
        client_id: 'client-1',
        tag_id: Number((await json(tagged)).data.id),
      });
    await textEntryReusedFactory({
      text_entry: await textEntryFactory({user: user1}),
      user: user1,
    });
    await db().insert(adminAuditLog).values({
      created: now(),
      action: 'deactivate',
      actor_id: user1.id,
      actor_username: user1.username,
      target_user_id: user1.id,
      target_username: user1.username,
    });

    expect(await tables(false)).toEqual([]);
  });

  it('starts the next test empty, its ids from 1', async () => {
    expect(await tables(true)).toEqual([]);
    expect(await sequences()).toEqual(['d1_migrations']);
    expect((await userFactory()).id).toBe(1);

    migrated = await schema();
    // A test that changes the schema, and leaves it changed.
    await db().run(
      sql.raw(`CREATE TRIGGER test_left_behind BEFORE DELETE ON users_user
        BEGIN SELECT RAISE(ABORT, 'left behind'); END`)
    );
  });

  it('starts the next test as migrated', async () => {
    expect(await schema()).toEqual(migrated);
    expect(await tables(true)).toEqual([]);
  });
});
