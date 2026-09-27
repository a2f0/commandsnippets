#!/usr/bin/env bun
/**
 * Ports of the Django management commands, run against D1 via wrangler.
 *
 *   bun scripts/manage.ts <command> [args] [--env staging|production]
 *
 * Without --env the local development database is used (optionally from
 * --persist-to <dir>); with --env the remote database for that environment.
 *
 *   list-users                         emails of all users
 *   list-recent-logins                 users by most recent login
 *   usage-report [--format csv] [--output file.csv]
 *   delete-user <username>             delete a user and all of their data
 */
import {writeFileSync} from 'node:fs';

type Row = Record<string, string | number | null>;

const args = process.argv.slice(2);
const flag = (name: string) => {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const [, value] = args.splice(index, 2);
  return value;
};
const environment = flag('--env');
const persistTo = flag('--persist-to');
const format = flag('--format') ?? 'stdout';
const output = flag('--output');
const [command, ...positional] = args;

async function query(sql: string): Promise<Row[]> {
  const target =
    environment === undefined
      ? [
          '--local',
          ...(persistTo === undefined ? [] : ['--persist-to', persistTo]),
        ]
      : ['--remote', '--env', environment];
  const proc = Bun.spawn(
    [
      'bunx',
      'wrangler',
      'd1',
      'execute',
      'DB',
      ...target,
      '--json',
      '--command',
      sql,
    ],
    {cwd: `${import.meta.dirname}/..`, stdout: 'pipe', stderr: 'pipe'}
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    throw new Error(`wrangler d1 execute failed:\n${stderr || stdout}`);
  }
  const [result] = JSON.parse(stdout) as Array<{results: Row[]}>;
  return result?.results ?? [];
}

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

const pad = (value: unknown, width: number) => {
  const text = String(value ?? 'None');
  return (text.length > width ? `${text.slice(0, width - 3)}...` : text).padEnd(
    width
  );
};

async function listUsers() {
  for (const {email} of await query(
    'SELECT email FROM users_user ORDER BY id'
  )) {
    console.log(email);
  }
}

async function listRecentLogins() {
  const users = await query(
    `SELECT username, email, last_login, date_joined, login_count FROM users_user
     ORDER BY last_login DESC NULLS LAST`
  );
  const widths = {
    username: 25,
    email: 40,
    last_login: 25,
    date_joined: 25,
    login_count: 10,
  };
  console.log(`Running user query at ${new Date().toISOString()}`);
  console.log(`Total users: ${users.length}`);
  console.log(
    Object.entries(widths)
      .map(([field, width]) => pad(field, width))
      .join(' | ')
  );
  console.log(
    '-'.repeat(Object.values(widths).reduce((a, b) => a + b, 0) + 3 * 4)
  );
  for (const user of users) {
    console.log(
      Object.entries(widths)
        .map(([field, width]) => pad(user[field], width))
        .join(' | ')
    );
  }
}

async function usageReport() {
  const rows = await query(
    `SELECT u.username, u.email,
       (SELECT COUNT(*) FROM tags_tag WHERE user_id = u.id) AS tag_count,
       (SELECT COUNT(*) FROM text_entries_textentry WHERE user_id = u.id) AS text_entry_count,
       (SELECT COUNT(*) FROM tags_tagtextentrythroughmodel WHERE user_id = u.id)
         AS tag_text_relationship_count
     FROM users_user u ORDER BY u.id`
  );
  const total = {
    username: 'TOTAL',
    email: '',
    tag_count: rows.reduce((sum, row) => sum + Number(row['tag_count']), 0),
    text_entry_count: rows.reduce(
      (sum, row) => sum + Number(row['text_entry_count']),
      0
    ),
    tag_text_relationship_count: rows.reduce(
      (sum, row) => sum + Number(row['tag_text_relationship_count']),
      0
    ),
  };
  const columns = [
    'username',
    'email',
    'tag_count',
    'text_entry_count',
    'tag_text_relationship_count',
  ] as const;

  if (format === 'csv') {
    const csvField = (value: unknown) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    };
    const csv = [
      columns.join(','),
      ...[...rows, total].map(row =>
        columns.map(c => csvField(row[c])).join(',')
      ),
    ]
      .join('\n')
      .concat('\n');
    if (output === undefined) {
      process.stdout.write(csv);
    } else {
      writeFileSync(output, csv);
      console.log(`Report saved to ${output}`);
    }
  } else {
    const line = (row: Row | typeof total) =>
      `${pad(row.username, 30)} ${pad(row.email, 30)} ${pad(row.tag_count, 10)} ` +
      `${pad(row.text_entry_count, 10)} ${pad(row.tag_text_relationship_count, 15)}`;
    console.log('=== User Usage Report ===');
    console.log(
      `${pad('Username', 30)} ${pad('Email', 30)} ${pad('Tags', 10)} ${pad('Entries', 10)} ${pad('Relationships', 15)}`
    );
    console.log('-'.repeat(95));
    for (const row of rows) {
      console.log(line(row));
    }
    console.log('-'.repeat(95));
    console.log(line(total));
  }

  const top = (key: 'tag_count' | 'text_entry_count', noun: string) =>
    [...rows]
      .sort((a, b) => Number(b[key]) - Number(a[key]))
      .slice(0, 5)
      .map(row => `${row['username']}: ${row[key]} ${noun}`);
  console.log(
    ['', 'Top 5 Users by Tag Count:', ...top('tag_count', 'tags')].join('\n')
  );
  console.log(
    [
      '',
      'Top 5 Users by Text Entry Count:',
      ...top('text_entry_count', 'entries'),
    ].join('\n')
  );
}

async function deleteUser(username: string | undefined) {
  if (username === undefined) {
    throw new Error('usage: delete-user <username>');
  }
  const [user] = await query(
    `SELECT id FROM users_user WHERE username = ${literal(username)}`
  );
  if (user === undefined) {
    throw new Error(`User matching query does not exist: ${username}`);
  }
  // Tokens, tags, entries, junctions and reuses go with it (ON DELETE CASCADE).
  await query(`DELETE FROM users_user WHERE id = ${Number(user['id'])}`);
  console.log(`Deleted ${username}`);
}

const commands: Record<string, () => Promise<void>> = {
  'list-users': listUsers,
  'list-recent-logins': listRecentLogins,
  'usage-report': usageReport,
  'delete-user': () => deleteUser(positional[0]),
};

const run = command === undefined ? undefined : commands[command];
if (run === undefined) {
  console.error(
    `usage: bun scripts/manage.ts <${Object.keys(commands).join('|')}> [--env staging|production]`
  );
  process.exit(2);
}
try {
  await run();
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
