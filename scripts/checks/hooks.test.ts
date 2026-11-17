import {afterEach, describe, expect, setDefaultTimeout, test} from 'bun:test';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const TOOL = path.join(REPO_ROOT, 'node_modules/.bin/agent-tool');

// Each test signs commits in fresh repositories and runs the real hooks, which
// takes a few seconds and longer on a busy machine than bun's 5s default.
setDefaultTimeout(30_000);

const temporary: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'hooks-test-'));
  temporary.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temporary.splice(0)) {
    rmSync(dir, {recursive: true, force: true});
  }
});

/**
 * The environment without Git's repository variables. A hook run exports them
 * (pre-push from a linked worktree sets GIT_DIR), and they would point every
 * test repository's git commands at the repository being pushed.
 */
const testEnv = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'))
);

function run(command: string[], cwd: string, env: Record<string, string> = {}) {
  const result = Bun.spawnSync(command, {
    cwd,
    env: {
      ...testEnv,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      ...env,
    },
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function git(repo: string, ...args: string[]): string {
  const result = run(['git', ...args], repo);
  expect(result.exitCode).toBe(0);
  return result.stdout.trim();
}

/** A scratch repo whose commits are SSH-signed with a throwaway key. */
function signedRepo(): string {
  const dir = tempDir();
  const key = path.join(dir, 'signing-key');
  expect(
    run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', key], dir)
      .exitCode
  ).toBe(0);
  // Without an allowed-signers file git reports SSH signatures as "N"
  // (unsigned), which the configured signature-presence check rejects.
  const allowedSigners = path.join(dir, 'allowed-signers');
  writeFileSync(
    allowedSigners,
    `test@example.com ${readFileSync(`${key}.pub`, 'utf8')}`
  );
  const repo = path.join(dir, 'repo');
  git(dir, 'init', '-q', '-b', 'main', repo);
  for (const [name, value] of [
    ['user.name', 'Test'],
    ['user.email', 'test@example.com'],
    ['gpg.format', 'ssh'],
    ['user.signingkey', key],
    ['commit.gpgsign', 'true'],
    ['gpg.ssh.allowedSignersFile', allowedSigners],
  ] as const) {
    git(repo, 'config', name, value);
  }
  return repo;
}

// Commits skip the installed commit-msg hook, which needs commitlint.
function commitAll(repo: string, message: string, sign = true): void {
  git(repo, 'add', '-A');
  git(
    repo,
    'commit',
    '-q',
    '--no-verify',
    '--allow-empty',
    ...(sign ? [] : ['--no-gpg-sign']),
    '-m',
    message
  );
}

/**
 * A signed repo carrying the real hooks, push-gate configuration and
 * classifier, with an empty bare `origin`. Its package scripts only append
 * their names to `log`, so a push shows which checks its gate ran.
 */
function hookRepo(): {repo: string; log: string} {
  const repo = signedRepo();
  const log = path.join(tempDir(), 'checks.log');
  for (const file of [
    'agent-tool.json',
    'commitlint.config.mts',
    'scripts/git/hooks/commit-msg',
    'scripts/git/hooks/pre-push',
    'scripts/checks/pushScope.ts',
    'scripts/checks/ciPolicy.ts',
    'scripts/checks/ciChanges.ts',
  ]) {
    mkdirSync(path.dirname(path.join(repo, file)), {recursive: true});
    cpSync(path.join(REPO_ROOT, file), path.join(repo, file));
  }
  writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\n');
  symlinkSync(
    path.join(REPO_ROOT, 'node_modules'),
    path.join(repo, 'node_modules'),
    'dir'
  );
  const scripts = ['lint', 'lint:shell', 'typecheck'];
  writeFileSync(
    path.join(repo, 'package.json'),
    JSON.stringify({
      scripts: Object.fromEntries(
        scripts.map(name => [name, `echo ${name} >> "$CHECKS_LOG"`])
      ),
    })
  );
  writeFileSync(path.join(repo, 'scripts/notes.txt'), 'notes\n');
  commitAll(repo, 'chore: add tooling');
  expect(run([TOOL, 'hooks', 'install', '--apply'], repo).exitCode).toBe(0);
  const origin = path.join(tempDir(), 'origin.git');
  git(repo, 'init', '-q', '--bare', origin);
  git(repo, 'remote', 'add', 'origin', origin);
  git(repo, 'push', '-q', '--no-verify', 'origin', 'main');
  git(repo, 'switch', '-q', '-c', 'feat/x');
  return {repo, log};
}

function push(repo: string, log: string) {
  const result = run(['git', 'push', 'origin', 'feat/x'], repo, {
    CHECKS_LOG: log,
  });
  return {...result, output: result.stdout + result.stderr};
}

describe('pre-push', () => {
  test('is the canonical push gate, with no test or install step', () => {
    const result = run([TOOL, 'push-gate', 'check'], REPO_ROOT);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({ok: true, errors: []});
    expect(result.exitCode).toBe(0);
  });

  test('runs the checks of the scopes a push changes', () => {
    const {repo, log} = hookRepo();
    appendFileSync(path.join(repo, 'scripts/notes.txt'), 'more\n');
    commitAll(repo, 'chore: edit notes');
    const result = push(repo, log);
    expect(result.exitCode).toBe(0);
    expect(readFileSync(log, 'utf8')).toBe('lint\nlint:shell\ntypecheck\n');
  });

  test('a push outside every scope runs no check', () => {
    const {repo, log} = hookRepo();
    writeFileSync(path.join(repo, 'NOTICE'), 'notice\n');
    commitAll(repo, 'docs: add notice');
    const result = push(repo, log);
    expect(result.exitCode).toBe(0);
    expect(existsSync(log)).toBe(false);
  });

  test('rejects untrusted commits before any check runs', () => {
    for (const message of [
      'chore: edit notes\n\nCo-authored-by: Ada <ada@example.com>',
      'chore: unsigned edit',
    ]) {
      const {repo, log} = hookRepo();
      appendFileSync(path.join(repo, 'scripts/notes.txt'), 'more\n');
      commitAll(repo, message, !message.includes('unsigned'));
      const result = push(repo, log);
      expect(result.exitCode).not.toBe(0);
      expect(result.output).toContain('commits');
      expect(existsSync(log)).toBe(false);
    }
  });
});

test('commit-msg rejects attribution without rewriting the message', () => {
  const {repo} = hookRepo();
  const message = 'fix: change\n\nCo-authored-by: Ada <ada@example.com>\n';
  const file = path.join(repo, '.git/TEST_COMMIT_EDITMSG');
  writeFileSync(file, message);
  const result = run(['.git/hooks/commit-msg', file], repo);
  expect(result.exitCode).toBe(1);
  expect(readFileSync(file, 'utf8')).toBe(message);
});
