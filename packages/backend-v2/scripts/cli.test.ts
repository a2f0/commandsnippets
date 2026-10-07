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
    // Otherwise `--output` would be taken as the format and no file written.
    ['--format followed by another flag', ['--format', '--output', 'r.csv']],
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
