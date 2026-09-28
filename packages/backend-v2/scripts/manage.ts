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
import {takeFlag} from './lib/args';
import {run} from './lib/process';
import {sqlLiteral} from './lib/sql';

export type Row = Record<string, string | number | null>;

/** Where commands read from and write to; tests substitute both. */
export interface CommandContext {
  query: (sql: string) => Promise<Row[]>;
  out: (text: string) => void;
}

const pad = (value: unknown, width: number) => {
  const text = String(value ?? 'None');
  return (text.length > width ? `${text.slice(0, width - 3)}...` : text).padEnd(
    width
  );
};

export async function listUsers({query, out}: CommandContext): Promise<void> {
  for (const {email} of await query(
    'SELECT email FROM users_user ORDER BY id'
  )) {
    out(String(email));
  }
}

export async function listRecentLogins({
  query,
  out,
}: CommandContext): Promise<void> {
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
  out(`Running user query at ${new Date().toISOString()}`);
  out(`Total users: ${users.length}`);
  out(
    Object.entries(widths)
      .map(([field, width]) => pad(field, width))
      .join(' | ')
  );
  out('-'.repeat(Object.values(widths).reduce((a, b) => a + b, 0) + 3 * 4));
  for (const user of users) {
    out(
      Object.entries(widths)
        .map(([field, width]) => pad(user[field], width))
        .join(' | ')
    );
  }
}

const REPORT_COLUMNS = [
  'username',
  'email',
  'tag_count',
  'text_entry_count',
  'tag_text_relationship_count',
] as const;

function csvField(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function usageReport(
  {query, out}: CommandContext,
  {
    format = 'stdout',
    output,
    writeFile = writeFileSync,
  }: {
    format?: string;
    output?: string | undefined;
    writeFile?: (path: string, data: string) => void;
  } = {}
): Promise<void> {
  const rows = await query(
    `SELECT u.username, u.email,
       (SELECT COUNT(*) FROM tags_tag WHERE user_id = u.id) AS tag_count,
       (SELECT COUNT(*) FROM text_entries_textentry WHERE user_id = u.id) AS text_entry_count,
       (SELECT COUNT(*) FROM tags_tagtextentrythroughmodel WHERE user_id = u.id)
         AS tag_text_relationship_count
     FROM users_user u ORDER BY u.id`
  );
  const sum = (key: string) =>
    rows.reduce((total, row) => total + Number(row[key]), 0);
  const total: Row = {
    username: 'TOTAL',
    email: '',
    tag_count: sum('tag_count'),
    text_entry_count: sum('text_entry_count'),
    tag_text_relationship_count: sum('tag_text_relationship_count'),
  };

  if (format === 'csv') {
    const csv = `${[
      REPORT_COLUMNS.join(','),
      ...[...rows, total].map(row =>
        REPORT_COLUMNS.map(column => csvField(row[column])).join(',')
      ),
    ].join('\n')}\n`;
    if (output === undefined) {
      out(csv.trimEnd());
    } else {
      writeFile(output, csv);
      out(`Report saved to ${output}`);
    }
  } else {
    const line = (row: Row) =>
      `${pad(row['username'], 30)} ${pad(row['email'], 30)} ${pad(row['tag_count'], 10)} ` +
      `${pad(row['text_entry_count'], 10)} ${pad(row['tag_text_relationship_count'], 15)}`;
    out('=== User Usage Report ===');
    out(
      `${pad('Username', 30)} ${pad('Email', 30)} ${pad('Tags', 10)} ${pad('Entries', 10)} ${pad('Relationships', 15)}`
    );
    out('-'.repeat(95));
    for (const row of rows) {
      out(line(row));
    }
    out('-'.repeat(95));
    out(line(total));
  }

  const top = (key: 'tag_count' | 'text_entry_count', noun: string) =>
    [...rows]
      .sort((a, b) => Number(b[key]) - Number(a[key]))
      .slice(0, 5)
      .map(row => `${row['username']}: ${row[key]} ${noun}`);
  out(
    ['', 'Top 5 Users by Tag Count:', ...top('tag_count', 'tags')].join('\n')
  );
  out(
    [
      '',
      'Top 5 Users by Text Entry Count:',
      ...top('text_entry_count', 'entries'),
    ].join('\n')
  );
}

export async function deleteUser(
  {query, out}: CommandContext,
  username: string | undefined
): Promise<void> {
  if (username === undefined) {
    throw new Error('usage: delete-user <username>');
  }
  const [user] = await query(
    `SELECT id FROM users_user WHERE username = ${sqlLiteral(username)}`
  );
  if (user === undefined) {
    throw new Error(`User matching query does not exist: ${username}`);
  }
  // Tokens, tags, entries, junctions and reuses go with it (ON DELETE CASCADE).
  await query(`DELETE FROM users_user WHERE id = ${Number(user['id'])}`);
  out(`Deleted ${username}`);
}

/** Run one command from CLI arguments; returns the process exit code. */
export async function runCommand(
  argv: string[],
  context: CommandContext
): Promise<number> {
  const args = [...argv];
  const format = takeFlag(args, '--format') ?? 'stdout';
  const output = takeFlag(args, '--output');
  const [command, username] = args;
  const commands: Record<string, () => Promise<void>> = {
    'list-users': () => listUsers(context),
    'list-recent-logins': () => listRecentLogins(context),
    'usage-report': () => usageReport(context, {format, output}),
    'delete-user': () => deleteUser(context, username),
  };
  const run = command === undefined ? undefined : commands[command];
  if (run === undefined) {
    context.out(
      `usage: bun scripts/manage.ts <${Object.keys(commands).join('|')}> [--env staging|production]`
    );
    return 2;
  }
  try {
    await run();
    return 0;
  } catch (error) {
    context.out((error as Error).message);
    return 1;
  }
}

/** Run SQL against D1 through `wrangler d1 execute`. */
function wranglerQuery(
  environment: string | undefined,
  persistTo: string | undefined,
  wrangler: string[] = ['bunx', 'wrangler']
) {
  return async (sql: string): Promise<Row[]> => {
    const target =
      environment === undefined
        ? [
            '--local',
            ...(persistTo === undefined ? [] : ['--persist-to', persistTo]),
          ]
        : ['--remote', '--env', environment];
    const {stdout, stderr, code} = await run(
      [
        ...wrangler,
        'd1',
        'execute',
        'DB',
        ...target,
        '--json',
        '--command',
        sql,
      ],
      {cwd: `${import.meta.dirname}/..`}
    );
    if (code !== 0) {
      throw new Error(`wrangler d1 execute failed:\n${stderr || stdout}`);
    }
    const [result] = JSON.parse(stdout) as Array<{results: Row[]}>;
    return result?.results ?? [];
  };
}

/** The CLI entry point; returns the process exit code. */
export function main(
  argv: string[],
  out: (text: string) => void = console.log,
  wrangler?: string[]
): Promise<number> {
  const args = [...argv];
  const environment = takeFlag(args, '--env');
  const persistTo = takeFlag(args, '--persist-to');
  return runCommand(args, {
    query: wranglerQuery(environment, persistTo, wrangler),
    out,
  });
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
