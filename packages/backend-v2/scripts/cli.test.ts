import {afterEach, describe, expect, test} from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {main as importMain, restoreToSql} from './import-postgres';
import {main as manageMain} from './manage';

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'backend-v2-cli-'));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, {recursive: true, force: true});
  }
});

/** An executable shell script standing in for a CLI dependency. */
function fakeBinary(dir: string, name: string, body: string): string {
  const file = path.join(dir, name);
  writeFileSync(file, `#!/bin/sh\n${body}\n`);
  chmodSync(file, 0o755);
  return file;
}

const T = '\t';
const MINIMAL_DUMP = [
  'COPY public.users_user (id, password, last_login, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined, date_updated, login_count) FROM stdin;',
  [
    '1',
    '',
    '\\N',
    'f',
    'alice',
    '',
    '',
    'a@example.com',
    'f',
    't',
    '2024-01-01 00:00:00+00',
    '2024-01-01 00:00:00+00',
    '1',
  ].join(T),
  '\\.',
  ...[
    'authtoken_token (key, created, user_id)',
    'text_entries_textentry (id, body, date_created, date_updated, subject, user_id, is_deleted, tag_count, reused_count, reused_date)',
    'tags_tag (id, name, date_created, date_updated, user_id, entry_count, date_last_used, "order", is_deleted)',
    'tags_tagtextentrythroughmodel (id, "order", tag_id, text_entry_id, date_created, date_updated, user_id)',
    'text_entries_textentryreused (id, date_created, text_entry_id, user_id)',
  ].flatMap(table => [`COPY public.${table} FROM stdin;`, '\\.']),
  "SELECT pg_catalog.setval('public.users_user_id_seq', 5, true);",
  '',
].join('\n');

describe('import-postgres CLI', () => {
  test('converts, writes, and verifies an archive', async () => {
    const dir = tempDir();
    const dumpFile = path.join(dir, 'dump.sql');
    writeFileSync(dumpFile, MINIMAL_DUMP);
    const pgRestore = fakeBinary(dir, 'pg_restore', `cat "${dumpFile}"`);
    const out = path.join(dir, 'out', 'import.sql');
    const log: string[] = [];

    expect(
      await importMain(['archive', '--out', out], l => log.push(l), pgRestore)
    ).toBe(0);
    expect(readFileSync(out, 'utf8')).toContain('INSERT INTO "users_user"');
    expect(log.join('\n')).toContain('Verification passed.');
  });

  test('prints usage without an archive', async () => {
    const log: string[] = [];
    expect(await importMain([], l => log.push(l))).toBe(2);
    expect(log[0]).toContain('usage:');
  });

  test('takes the archive from after --out <file>', async () => {
    const dir = tempDir();
    const dumpFile = path.join(dir, 'dump.sql');
    writeFileSync(dumpFile, MINIMAL_DUMP);
    const argsFile = path.join(dir, 'args');
    const pgRestore = fakeBinary(
      dir,
      'pg_restore',
      `printf '%s\\n' "$@" > "${argsFile}"\ncat "${dumpFile}"`
    );
    const out = path.join(dir, 'import.sql');

    expect(
      await importMain(['--out', out, 'the-archive'], () => {}, pgRestore)
    ).toBe(0);
    expect(readFileSync(argsFile, 'utf8').trim().split('\n').at(-1)).toBe(
      'the-archive'
    );
    expect(readFileSync(out, 'utf8')).toContain('INSERT INTO "users_user"');
  });

  test.each([
    ['a trailing --out', (file: string) => [file, '--out']],
    ['--out taking the only other argument', (file: string) => ['--out', file]],
  ])('prints usage for %s before running pg_restore', async (_name, argv) => {
    const dir = tempDir();
    const dumpFile = path.join(dir, 'dump.sql');
    writeFileSync(dumpFile, MINIMAL_DUMP);
    const ran = path.join(dir, 'ran');
    const pgRestore = fakeBinary(
      dir,
      'pg_restore',
      `touch "${ran}"\ncat "${dumpFile}"`
    );
    const log: string[] = [];

    expect(
      await importMain(
        argv(path.join(dir, 'file')),
        l => log.push(l),
        pgRestore
      )
    ).toBe(2);
    expect(log).toEqual([
      'usage: bun scripts/import-postgres.ts <backup-pg_dump-Fc> [--out file.sql]',
    ]);
    expect(existsSync(ran)).toBe(false);
  });

  test('feeds the archive on stdin to a multi-word pg_restore (e.g. docker)', async () => {
    const dir = tempDir();
    const archive = path.join(dir, 'archive');
    writeFileSync(archive, 'dump-from-stdin');
    const pgRestore = fakeBinary(dir, 'pg_restore', 'cat');
    expect(await restoreToSql(archive, `sh ${pgRestore}`)).toBe(
      'dump-from-stdin'
    );
  });

  test('passes the archive path to a single-word pg_restore', async () => {
    const dir = tempDir();
    const pgRestore = fakeBinary(dir, 'pg_restore', 'printf "%s|" "$@"');
    expect(await restoreToSql('the-archive', pgRestore)).toBe(
      '--data-only|--no-owner|-f|-|the-archive|'
    );
  });

  test('surfaces a pg_restore failure', async () => {
    const dir = tempDir();
    const pgRestore = fakeBinary(
      dir,
      'pg_restore',
      'echo bad archive >&2; exit 3'
    );
    await expect(restoreToSql('x', pgRestore)).rejects.toThrow(
      'pg_restore failed (3):\nbad archive'
    );
  });
});

describe('manage CLI', () => {
  function fakeWrangler(dir: string, output: string, exitCode = 0) {
    const argsFile = path.join(dir, 'args');
    const binary = fakeBinary(
      dir,
      'wrangler',
      `printf '%s\\n' "$@" > "${argsFile}"\nprintf '%s' '${output}'\nexit ${exitCode}`
    );
    return {
      wrangler: ['sh', binary],
      args: () => readFileSync(argsFile, 'utf8').trim().split('\n'),
      called: () => existsSync(argsFile),
    };
  }

  test('queries local D1 by default, honoring --persist-to', async () => {
    const dir = tempDir();
    const fake = fakeWrangler(dir, '[{"results":[{"email":"a@example.com"}]}]');
    const out: string[] = [];
    expect(
      await manageMain(
        ['list-users', '--persist-to', '/state'],
        l => out.push(l),
        fake.wrangler
      )
    ).toBe(0);
    expect(out).toEqual(['a@example.com']);
    expect(fake.args().slice(0, 6)).toEqual([
      'd1',
      'execute',
      'DB',
      '--local',
      '--persist-to',
      '/state',
    ]);
  });

  test('targets the remote database for --env', async () => {
    const dir = tempDir();
    const fake = fakeWrangler(dir, '[{"results":[]}]');
    expect(
      await manageMain(
        ['list-users', '--env', 'production'],
        () => {},
        fake.wrangler
      )
    ).toBe(0);
    expect(fake.args().slice(3, 6)).toEqual([
      '--remote',
      '--env',
      'production',
    ]);
  });

  // Falling back to the local database, or passing wrangler an environment
  // it does not define, would run the command against the wrong database.
  test.each([
    ['a bare --env', ['--env']],
    ['an unknown --env', ['--env', 'prod']],
    ['--env followed by another flag', ['--env', '--persist-to', '/state']],
    ['a bare --persist-to', ['--persist-to']],
  ])('refuses %s before querying any database', async (_name, flags) => {
    const dir = tempDir();
    const fake = fakeWrangler(dir, '[{"results":[]}]');
    const out: string[] = [];
    expect(
      await manageMain(
        ['list-users', ...flags],
        l => out.push(l),
        fake.wrangler
      )
    ).toBe(2);
    expect(out).toEqual([
      'usage: bun scripts/manage.ts <list-users|list-recent-logins|usage-report|delete-user> [--env staging|production]',
    ]);
    expect(fake.called()).toBe(false);
  });

  test('reports a failed wrangler call', async () => {
    const dir = tempDir();
    const fake = fakeWrangler(dir, 'boom', 1);
    const out: string[] = [];
    expect(
      await manageMain(['list-users'], l => out.push(l), fake.wrangler)
    ).toBe(1);
    expect(out[0]).toContain('wrangler d1 execute failed');
  });

  test('treats an empty result set as no rows', async () => {
    const dir = tempDir();
    const fake = fakeWrangler(dir, '[]');
    const out: string[] = [];
    expect(
      await manageMain(['list-users'], l => out.push(l), fake.wrangler)
    ).toBe(0);
    expect(out).toEqual([]);
  });
});
