import {afterEach, expect, test} from 'bun:test';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const SCRIPT = path.resolve(import.meta.dirname, 'ciBranchTip.sh');

const temporary: string[] = [];
afterEach(() => {
  for (const dir of temporary.splice(0)) {
    rmSync(dir, {recursive: true, force: true});
  }
});

/** The environment without Git's repository variables or the user's config. */
const testEnv = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !(name.startsWith('GIT_') || name.startsWith('GITHUB_'))
    )
  ),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

function git(cwd: string, ...args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], {cwd, env: testEnv});
  expect(result.exitCode).toBe(0);
  return result.stdout.toString().trim();
}

/**
 * A clone whose origin's main went from `older` to `newer`: a run for
 * `older` whose tests finish after `newer` was pushed.
 */
function pushedTwice() {
  const dir = mkdtempSync(path.join(tmpdir(), 'ci-branch-tip-test-'));
  temporary.push(dir);
  const origin = path.join(dir, 'origin.git');
  const repo = path.join(dir, 'repo');
  git(dir, 'init', '-q', '--bare', '-b', 'main', origin);
  git(dir, 'init', '-q', '-b', 'main', repo);
  git(repo, 'config', 'user.name', 'Test');
  git(repo, 'config', 'user.email', 'test@example.com');
  git(repo, 'remote', 'add', 'origin', origin);
  const commit = (message: string) => {
    git(repo, 'commit', '-q', '--allow-empty', '-m', message);
    git(repo, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
    return git(repo, 'rev-parse', 'HEAD');
  };
  const older = commit('chore: older');
  const newer = commit('chore: newer');
  return {dir, repo, older, newer};
}

function branchTip(
  {dir, repo}: {dir: string; repo: string},
  sha: string,
  ref = 'refs/heads/main'
) {
  const output = path.join(mkdtempSync(path.join(dir, 'run-')), 'output');
  writeFileSync(output, '');
  const result = Bun.spawnSync(['sh', SCRIPT], {
    cwd: repo,
    env: {...testEnv, GITHUB_REF: ref, GITHUB_SHA: sha, GITHUB_OUTPUT: output},
  });
  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString(),
    output: readFileSync(output, 'utf8'),
  };
}

test('the tip of its branch is current', () => {
  const origin = pushedTwice();
  expect(branchTip(origin, origin.newer)).toMatchObject({
    exitCode: 0,
    output: 'current=true\n',
  });
});

// Out-of-order completion: the older run's tests finish after a newer push,
// so it must stand down rather than deploy over the newer commit.
test('a commit that a newer push superseded is not current', () => {
  const origin = pushedTwice();
  expect(branchTip(origin, origin.older)).toMatchObject({
    exitCode: 0,
    output: 'current=false\n',
  });
});

test('reads the branch itself, not a longer ref ending in its name', () => {
  const origin = pushedTwice();
  git(
    origin.repo,
    'push',
    '-q',
    'origin',
    `${origin.older}:refs/heads/x/refs/heads/main`
  );
  expect(branchTip(origin, origin.newer).output).toBe('current=true\n');
});

test('fails without an answer when origin cannot be read', () => {
  const origin = pushedTwice();
  git(
    origin.repo,
    'remote',
    'set-url',
    'origin',
    path.join(origin.dir, 'gone.git')
  );
  const result = branchTip(origin, origin.newer);
  expect(result.exitCode).not.toBe(0);
  expect(result.output).toBe('');
});

test.each([
  ['a ref that is not a branch', 'refs/pull/1/merge', 'Not a branch'],
  ['a branch origin does not have', 'refs/heads/staging', 'origin has no'],
])('fails without an answer for %s', (_name, ref, message) => {
  const origin = pushedTwice();
  const result = branchTip(origin, origin.newer, ref);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain(message);
  expect(result.output).toBe('');
});
