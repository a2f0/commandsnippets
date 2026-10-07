import {Database} from 'bun:sqlite';
import {beforeEach, describe, expect, test} from 'bun:test';
import * as migrations from './lib/migrations';
import {
  type CommandContext,
  deleteUser,
  listRecentLogins,
  listUsers,
  type Row,
  runCommand,
  usageReport,
} from './manage';

let db: Database;
let lines: string[];

/** Commands run against a real SQLite built from the migrations. */
function context(): CommandContext {
  return {
    query: async sql => db.query(sql).all() as Row[],
    out: text => lines.push(text),
  };
}

const TS = '2024-01-01T00:00:00.000000';

function seedUser(
  id: number,
  username: string,
  email: string,
  lastLogin: string | null
) {
  db.run(
    `INSERT INTO users_user (id, username, email, last_login, date_joined, date_updated, login_count)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [id, username, email, lastLogin, TS, TS]
  );
  db.run('INSERT INTO authtoken_token (key, user_id) VALUES (?, ?)', [
    String(id).repeat(40).slice(0, 40),
    id,
  ]);
}

function seedContent(userId: number, tags: number, entries: number) {
  const tagIds: number[] = [];
  for (let i = 0; i < tags; i++) {
    db.run(
      `INSERT INTO tags_tag (name, date_created, date_updated, user_id, "order") VALUES (?, ?, ?, ?, ?)`,
      [`t${userId}-${i}`, TS, TS, userId, i]
    );
    tagIds.push(
      (db.query('SELECT last_insert_rowid() AS id').get() as {id: number}).id
    );
  }
  for (let i = 0; i < entries; i++) {
    db.run(
      `INSERT INTO text_entries_textentry (subject, body, date_created, date_updated, user_id) VALUES ('s', 'b', ?, ?, ?)`,
      [TS, TS, userId]
    );
    const entryId = (
      db.query('SELECT last_insert_rowid() AS id').get() as {id: number}
    ).id;
    const tagId = tagIds[i % tagIds.length];
    if (tagId !== undefined) {
      db.run(
        `INSERT INTO tags_tagtextentrythroughmodel ("order", tag_id, text_entry_id, date_created, date_updated, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [i, tagId, entryId, TS, TS, userId]
      );
    }
    db.run(
      'INSERT INTO text_entries_textentryreused (date_created, text_entry_id, user_id) VALUES (?, ?, ?)',
      [TS, entryId, userId]
    );
  }
}

beforeEach(() => {
  db = new Database(':memory:');
  db.run('PRAGMA foreign_keys = ON');
  migrations.load(db);
  lines = [];
  seedUser(1, 'alice', 'alice@example.com', '2024-03-01T00:00:00.000000');
  seedUser(2, "o'brien", 'ob,rien@example.com', null);
  seedUser(3, 'carol', 'carol@example.com', '2024-05-01T00:00:00.000000');
  seedContent(1, 2, 3);
  seedContent(2, 1, 1);
});

const count = (table: string, userId: number) =>
  (
    db
      .query(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`)
      .get(userId) as {n: number}
  ).n;

describe('list-users', () => {
  test('prints every email in id order', async () => {
    await listUsers(context());
    expect(lines).toEqual([
      'alice@example.com',
      'ob,rien@example.com',
      'carol@example.com',
    ]);
  });
});

describe('list-recent-logins', () => {
  test('orders by most recent login, never-logged-in last', async () => {
    await listRecentLogins(context());
    expect(lines[1]).toBe('Total users: 3');
    const rows = lines.slice(4).map(line => line.split('|')[0]?.trim());
    expect(rows).toEqual(['carol', 'alice', "o'brien"]);
    expect(lines.at(-1)).toContain('None');
  });
});

describe('usage-report', () => {
  test('prints per-user counts, totals, and the top lists', async () => {
    await usageReport(context());
    const total = lines.find(line => line.startsWith('TOTAL'));
    expect(total?.split(/\s+/).slice(1, 4)).toEqual(['3', '4', '4']);
    expect(lines.join('\n')).toContain('alice: 2 tags');
    expect(lines.join('\n')).toContain('alice: 3 entries');
  });

  test("counts only the live rows of each user's active data version", async () => {
    const report = async () => {
      lines = [];
      await usageReport(context(), {format: 'csv'});
      return lines.join('\n').split('\n');
    };
    // Untagged and deleted: one of alice's entries, and the tagging of another.
    db.run(
      'UPDATE text_entries_textentry SET is_deleted = 1 WHERE id = (SELECT MIN(id) FROM text_entries_textentry WHERE user_id = 1)'
    );
    db.run(
      'UPDATE tags_tagtextentrythroughmodel SET is_deleted = 1 WHERE id = (SELECT MAX(id) FROM tags_tagtextentrythroughmodel WHERE user_id = 1)'
    );
    expect(await report()).toContain('alice,alice@example.com,2,2,2');

    // A restore elsewhere: version 2 active, with one tag; version 1 is kept.
    db.run(
      `INSERT INTO users_dataversion (user_id, version, date_created, origin) VALUES (1, 2, '${TS}', 'restore')`
    );
    db.run(
      'UPDATE users_user SET last_version = 2, active_version = 2 WHERE id = 1'
    );
    db.run(
      `INSERT INTO tags_tag (name, date_created, date_updated, user_id, "order", version) VALUES ('restored', '${TS}', '${TS}', 1, 0, 2)`
    );
    const rows = await report();
    expect(rows).toContain('alice,alice@example.com,1,0,0');
    expect(rows).toContain('TOTAL,,2,1,1');
  });

  test('writes CSV, quoting fields that need it', async () => {
    await usageReport(context(), {format: 'csv'});
    const csv = lines[0]?.split('\n') ?? [];
    expect(csv[0]).toBe(
      'username,email,tag_count,text_entry_count,tag_text_relationship_count'
    );
    expect(csv).toContain(`o'brien,"ob,rien@example.com",1,1,1`);
    expect(csv).toContain('TOTAL,,3,4,4');
  });

  test('saves CSV to a file when asked', async () => {
    const written: Record<string, string> = {};
    await usageReport(context(), {
      format: 'csv',
      output: 'report.csv',
      writeFile: (path, data) => {
        written[path] = data;
      },
    });
    expect(written['report.csv']?.split('\n')[0]).toContain('username,email');
    expect(lines[0]).toBe('Report saved to report.csv');
  });
});

describe('delete-user', () => {
  test("cascades to all of the user's data and nobody else's", async () => {
    await deleteUser(context(), 'alice');
    expect(lines).toEqual(['Deleted alice']);
    for (const table of [
      'authtoken_token',
      'tags_tag',
      'text_entries_textentry',
      'tags_tagtextentrythroughmodel',
      'text_entries_textentryreused',
    ]) {
      expect(count(table, 1)).toBe(0);
    }
    expect(count('tags_tag', 2)).toBe(1);
    expect(count('text_entries_textentry', 2)).toBe(1);
  });

  test('handles usernames that need SQL quoting', async () => {
    await deleteUser(context(), "o'brien");
    expect(count('tags_tag', 2)).toBe(0);
    expect(count('tags_tag', 1)).toBe(2);
  });

  test('refuses an unknown or missing username', async () => {
    await expect(deleteUser(context(), 'nobody')).rejects.toThrow(
      'User matching query does not exist: nobody'
    );
    await expect(deleteUser(context(), undefined)).rejects.toThrow(
      'usage: delete-user <username>'
    );
  });
});

describe('runCommand', () => {
  test('dispatches commands with their flags', async () => {
    expect(
      await runCommand(['usage-report', '--format', 'csv'], context())
    ).toBe(0);
    expect(lines[0]?.startsWith('username,email')).toBe(true);
  });

  test('reports usage for a flag with no value, not a default', async () => {
    expect(
      await runCommand(
        ['usage-report', '--format', 'csv', '--output'],
        context()
      )
    ).toBe(2);
    expect(lines).toEqual([
      expect.stringContaining('usage: bun scripts/manage.ts'),
    ]);
  });

  test('reports usage for an unknown command and errors as exit 1', async () => {
    expect(await runCommand(['frobnicate'], context())).toBe(2);
    expect(lines[0]).toContain('usage: bun scripts/manage.ts');
    lines = [];
    // Names every object inherits are not commands either.
    for (const command of ['constructor', 'toString']) {
      expect(await runCommand([command], context())).toBe(2);
    }
    lines = [];
    expect(await runCommand(['delete-user', 'nobody'], context())).toBe(1);
    expect(lines).toEqual(['User matching query does not exist: nobody']);
  });
});
