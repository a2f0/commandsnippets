import {Database} from 'bun:sqlite';
import {describe, expect, test} from 'bun:test';
import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

// Migrations run against databases with data in them. Every table cascades
// from users_user, so a migration that rebuilt it (drizzle-kit's
// create-copy-drop for some SQLite changes) would delete everyone's data.
const dir = path.join(import.meta.dirname, '..', 'migrations');
const files = readdirSync(dir)
  .filter(name => name.endsWith('.sql'))
  .sort();

function apply(db: Database, file: string): void {
  const text = readFileSync(path.join(dir, file), 'utf8');
  for (const statement of text.split('--> statement-breakpoint')) {
    if (statement.trim() !== '') {
      db.run(statement);
    }
  }
}

function seed(db: Database): void {
  const at = '2026-01-01T00:00:00.000000';
  db.run(
    `INSERT INTO users_user (id, username, email, is_superuser, is_staff, is_active, date_joined, date_updated)
     VALUES (1, 'alice', 'alice@example.com', 1, 1, 1, '${at}', '${at}')`
  );
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
}

const counts = (db: Database) =>
  Object.fromEntries(
    [
      'users_user',
      'authtoken_token',
      'tags_tag',
      'text_entries_textentry',
      'tags_tagtextentrythroughmodel',
    ].map(table => [
      table,
      (db.query(`SELECT COUNT(*) AS n FROM ${table}`).get() as {n: number}).n,
    ])
  );

describe('0004_admin', () => {
  test('drops is_superuser in place, keeping every row', () => {
    const db = new Database(':memory:');
    db.run('PRAGMA foreign_keys = ON');
    const index = files.indexOf('0004_admin.sql');
    expect(index).toBeGreaterThan(0);
    for (const file of files.slice(0, index)) {
      apply(db, file);
    }
    seed(db);
    const before = counts(db);

    apply(db, '0004_admin.sql');

    expect(counts(db)).toEqual(before);
    expect(Object.values(before).every(n => n === 1)).toBe(true);
    const columns = (
      db.query('PRAGMA table_info(users_user)').all() as {name: string}[]
    ).map(column => column.name);
    expect(columns).not.toContain('is_superuser');
    expect(columns).toContain('is_staff');
    expect(
      db.query('SELECT username, is_staff, is_active FROM users_user').get()
    ).toEqual({username: 'alice', is_staff: 1, is_active: 1});
  });

  test('never rebuilds users_user', () => {
    const text = readFileSync(path.join(dir, '0004_admin.sql'), 'utf8');
    expect(text).not.toMatch(/DROP TABLE `?users_user/);
    expect(text).not.toMatch(/__new_users_user/);
  });
});
