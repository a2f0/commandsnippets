import {applyD1Migrations, reset} from 'cloudflare:test';
import {env} from 'cloudflare:workers';
import {afterEach, beforeAll, beforeEach, vi} from 'vitest';

// Each test starts from an empty, fully migrated database (Django's
// TestCase isolation). Migrating runs every migration's statements, so each
// test file migrates its database once, and each test empties it: every
// table's rows, and their AUTOINCREMENT counters, so ids start at 1 again.

/** The tables tests write: every one but D1's and the migrations' record. */
const TABLES = `SELECT name FROM sqlite_master WHERE type = 'table'
  AND name NOT IN ('d1_migrations', 'sqlite_sequence')
  AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
  ORDER BY name`;

/** The schema: every table, index, trigger and view, as created. */
const SCHEMA = 'SELECT type, name, sql FROM sqlite_master ORDER BY type, name';

/** The schema as migrated, which a test may change (restore.test.ts does). */
let migrated = '';
/** The statements that empty the database, run as one batch. */
let emptying: D1PreparedStatement[] = [];

const schema = async () =>
  JSON.stringify((await env.DB.prepare(SCHEMA).all()).results);

async function migrate(): Promise<void> {
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  migrated = await schema();
  const {results} = await env.DB.prepare(TABLES).all<{name: string}>();
  const tables = results.map(({name}) => name);
  // Emptying would delete rows the migrations seed; none do.
  const counts = await env.DB.batch<{name: string; rows: number}>(
    tables.map(table =>
      env.DB.prepare(`SELECT ? AS name, COUNT(*) AS rows FROM "${table}"`).bind(
        table
      )
    )
  );
  const seeded = counts.flatMap(({results: [count]}) =>
    count !== undefined && count.rows > 0 ? [count.name] : []
  );
  if (seeded.length > 0) {
    throw new Error(
      `Migrations seed ${seeded.join(', ')}: test/setup.ts must keep the rows`
    );
  }
  // Users first: deleting them cascades to their data as deleting an account
  // does, which the data version triggers allow (deleting the rows of a
  // version that is not active one by one, they refuse). The rest is left.
  emptying = [
    ...['users_user', ...tables.filter(table => table !== 'users_user')].map(
      table => env.DB.prepare(`DELETE FROM "${table}"`)
    ),
    env.DB.prepare(
      `DELETE FROM sqlite_sequence WHERE name IN (${tables.map(() => '?').join(', ')})`
    ).bind(...tables),
  ];
}

beforeAll(migrate);

beforeEach(async () => {
  if ((await schema()) === migrated) {
    await env.DB.batch(emptying);
  } else {
    await migrate();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});
