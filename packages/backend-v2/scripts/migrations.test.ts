import {Database} from 'bun:sqlite';
import {describe, expect, test} from 'bun:test';
import {is} from 'drizzle-orm';
import {getTableConfig, SQLiteTable} from 'drizzle-orm/sqlite-core';
import * as schema from '../src/db/schema';
import RESERVED_USERNAMES from '../src/services/reserved-usernames.json';
import * as migrations from './lib/migrations';

// Migrations run against databases with data in them. Every table cascades
// from users_user, so a migration that rebuilt it (drizzle-kit's
// create-copy-drop for some SQLite changes) would delete everyone's data.
const files = migrations.files();
/**
 * Columns a migration has not dropped yet although src/db/schema.ts no longer
 * has them: the first release of a two-release column removal (README,
 * Deployment). Empty between removals.
 */
const PENDING_DROPS: Record<string, string[]> = {
  // Django's, which nothing sets or reads.
  users_user: ['first_name', 'last_name'],
  text_entries_textentry: ['reused_date'],
};

/** The schema the Postgres import loaded; later migrations run on real data. */
const IMPORTED = '0003_unique_user_email.sql';

function seed(db: Database): void {
  const at = '2026-01-01T00:00:00.000000';
  const login = '2026-02-01T00:00:00.000000';
  db.run(
    `INSERT INTO users_user (id, username, email, is_staff, is_active, last_login, date_joined, date_updated)
     VALUES (1, 'alice', 'alice@example.com', 1, 1, '${login}', '${at}', '${at}')`
  );
  // Every username the web app's routes reserve, capitalized: a migration
  // must rename existing accounts that have one (0006 did for the first two).
  RESERVED_USERNAMES.forEach((name, index) => {
    const username = name.charAt(0).toUpperCase() + name.slice(1);
    db.run(
      `INSERT INTO users_user (id, username, email, date_joined, date_updated)
       VALUES (${index + 2}, '${username}', '${name}@example.com', '${at}', '${at}')`
    );
  });
  db.run(
    `INSERT INTO authtoken_token (key, created, user_id) VALUES ('${'a'.repeat(40)}', '${at}', 1)`
  );
  db.run(
    `INSERT INTO tags_tag (id, name, user_id, "order", date_created, date_updated, date_last_used)
     VALUES (1, 'tag', 1, 1, '${at}', '${at}', '${at}')`
  );
  db.run(
    `INSERT INTO text_entries_textentry (id, subject, body, user_id, date_created, date_updated)
     VALUES (1, 'subject', 'body', 1, '${at}', '${at}')`
  );
  db.run(
    `INSERT INTO tags_tagtextentrythroughmodel (tag_id, text_entry_id, user_id, "order", date_created, date_updated)
     VALUES (1, 1, 1, 1, '${at}', '${at}')`
  );
  db.run(
    `INSERT INTO text_entries_textentryreused (text_entry_id, user_id, date_created)
     VALUES (1, 1, '${at}')`
  );
}

const TABLES = [
  'users_user',
  'authtoken_token',
  'tags_tag',
  'text_entries_textentry',
  'tags_tagtextentrythroughmodel',
  'text_entries_textentryreused',
];

const counts = (db: Database) =>
  Object.fromEntries(
    TABLES.map(table => [
      table,
      (db.query(`SELECT COUNT(*) AS n FROM ${table}`).get() as {n: number}).n,
    ])
  );

describe('migrations', () => {
  test('every migration after the import keeps every row', () => {
    const db = new Database(':memory:');
    db.run('PRAGMA foreign_keys = ON');
    const imported = files.indexOf(IMPORTED);
    expect(imported).toBeGreaterThan(0);
    migrations.load(db, {through: IMPORTED});
    seed(db);
    const before = counts(db);
    expect(before['users_user']).toBe(1 + RESERVED_USERNAMES.length);

    for (const file of files.slice(imported + 1)) {
      migrations.apply(db, file);
      expect({file, counts: counts(db)}).toEqual({file, counts: before});
    }
    expect(
      db
        .query(
          'SELECT username, is_staff, is_active, last_active FROM users_user WHERE id = 1'
        )
        .get()
    ).toEqual({
      username: 'alice',
      is_staff: 1,
      is_active: 1,
      // 0007 starts it at the last login; never logged in stays NULL.
      last_active: '2026-02-01T00:00:00.000000',
    });
    expect(
      db.query('SELECT last_active FROM users_user WHERE id = 2').get()
    ).toEqual({last_active: null});
    const usernames = (
      db.query('SELECT username FROM users_user ORDER BY id').all() as {
        username: string;
      }[]
    ).map(row => row.username);
    expect(usernames[1]).toBe('Admin-2');
    expect(
      usernames.filter(name => RESERVED_USERNAMES.includes(name.toLowerCase()))
    ).toEqual([]);
  });

  test('leave the database matching src/db/schema.ts', () => {
    const db = new Database(':memory:');
    migrations.load(db);
    const tables = Object.values(schema).filter(value =>
      is(value, SQLiteTable)
    );
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      const {name, columns} = getTableConfig(table);
      const actual = (
        db.query(`PRAGMA table_info(${name})`).all() as {name: string}[]
      ).map(column => column.name);
      const expected = [
        ...columns.map(column => column.name),
        ...(PENDING_DROPS[name] ?? []),
      ];
      expect({table: name, columns: actual.sort()}).toEqual({
        table: name,
        columns: expected.sort(),
      });
    }
  });

  test("the tags_tagclientid rebuild keeps every client id, at its tag's version", () => {
    const db = new Database(':memory:');
    db.run('PRAGMA foreign_keys = ON');
    migrations.load(db, {through: '0017_drop_restore_cutoff.sql'});
    seed(db);
    db.run(
      `INSERT INTO tags_tagclientid (user_id, client_id, tag_id) VALUES (1, 'local-1', 1)`
    );

    migrations.apply(db, '0018_data_versions_schema.sql');

    expect(
      db
        .query(
          'SELECT user_id, version, client_id, tag_id FROM tags_tagclientid'
        )
        .all()
    ).toEqual([{user_id: 1, version: 1, client_id: 'local-1', tag_id: 1}]);
  });

  test('none rebuilds users_user', () => {
    const rebuilds = files.filter(file =>
      /DROP TABLE `?users_user|__new_users_user/.test(migrations.read(file))
    );
    expect(rebuilds).toEqual([]);
  });

  test('load refuses an unknown migration', () => {
    expect(() =>
      migrations.load(new Database(':memory:'), {through: '9999_none.sql'})
    ).toThrow('No migration named 9999_none.sql');
  });
});
