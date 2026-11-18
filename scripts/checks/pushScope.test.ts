import {afterEach, describe, expect, test} from 'bun:test';
import {
  appendFileSync,
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

const temporary: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'push-scope-test-'));
  temporary.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temporary.splice(0)) {
    rmSync(dir, {recursive: true, force: true});
  }
});

/** The environment without Git's repository variables, which a hook exports. */
const testEnv = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'))
  ),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

function run(command: string[], cwd: string, env: Record<string, string> = {}) {
  const result = Bun.spawnSync(command, {cwd, env: {...testEnv, ...env}});
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

function commitAll(repo: string, message: string): void {
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '--allow-empty', '-m', message);
}

function write(repo: string, file: string, text = `${file}\n`): void {
  mkdirSync(path.dirname(path.join(repo, file)), {recursive: true});
  writeFileSync(path.join(repo, file), text);
}

/**
 * A repository carrying the classifier, with `setup` committed on `main`
 * before the `feat/x` branch starts.
 */
function scopeRepo(setup?: (repo: string) => void): string {
  const dir = tempDir();
  const repo = path.join(dir, 'repo');
  git(dir, 'init', '-q', '-b', 'main', repo);
  git(repo, 'config', 'user.name', 'Test');
  git(repo, 'config', 'user.email', 'test@example.com');
  for (const file of ['pushScope.ts', 'ciPolicy.ts', 'ciChanges.ts']) {
    cpSync(
      path.join(REPO_ROOT, 'scripts/checks', file),
      path.join(repo, 'scripts/checks', file)
    );
  }
  write(repo, 'scripts/notes.txt');
  setup?.(repo);
  commitAll(repo, 'chore: base');
  git(repo, 'switch', '-q', '-c', 'feat/x');
  return repo;
}

interface Ref {
  localOid?: string;
  base?: string | null;
  deleted?: boolean;
}

/** The push data agent-tool hands its steps; a ref's base defaults to main. */
function pushData(repo: string, refs: Ref[] = [{}]): string {
  const file = path.join(tempDir(), 'push.json');
  const head = git(repo, 'rev-parse', 'HEAD');
  writeFileSync(
    file,
    JSON.stringify({
      schemaVersion: 1,
      headOid: head,
      refs: refs.map(ref => ({
        remoteRef: 'refs/heads/feat/x',
        localOid: ref.localOid ?? head,
        deleted: ref.deleted ?? false,
        base:
          ref.base === undefined ? git(repo, 'rev-parse', 'main') : ref.base,
      })),
    })
  );
  return file;
}

function pushScope(repo: string, scope: string, refs?: Ref[]) {
  const caller = path.dirname(repo);
  const result = run(
    ['bun', path.join(repo, 'scripts/checks/pushScope.ts'), scope],
    caller,
    {
      AGENT_TOOL_PUSH_GATE: path.relative(caller, pushData(repo, refs)),
    }
  );
  return {...result, output: result.stdout.trim()};
}

describe('pushScope', () => {
  test('runs a scope the pushed commits change and skips the rest', () => {
    const repo = scopeRepo();
    appendFileSync(path.join(repo, 'scripts/notes.txt'), 'more\n');
    commitAll(repo, 'chore: edit notes');
    expect(pushScope(repo, 'tooling').output).toBe('run');
    expect(pushScope(repo, 'terraform').output).toBe('skip');
  });

  test('moving a file out of a checked area still runs its checks', () => {
    const repo = scopeRepo();
    git(repo, 'mv', 'scripts/notes.txt', 'notes.txt');
    commitAll(repo, 'chore: move notes');
    expect(pushScope(repo, 'tooling').output).toBe('run');
  });

  test('classifies from the base, not only the newest commit', () => {
    const repo = scopeRepo();
    write(repo, 'terraform/main.tf');
    commitAll(repo, 'chore: add terraform');
    write(repo, 'NOTICE');
    commitAll(repo, 'docs: add notice');
    expect(pushScope(repo, 'terraform').output).toBe('run');
  });

  test('falls back to where the branch left main', () => {
    const repo = scopeRepo();
    write(repo, 'terraform/main.tf');
    commitAll(repo, 'chore: add terraform');
    expect(pushScope(repo, 'terraform', [{base: null}]).output).toBe('run');
    expect(pushScope(repo, 'website', [{base: null}]).output).toBe('skip');
  });

  test('runs every scope when nothing anchors the push', () => {
    const repo = scopeRepo();
    git(repo, 'branch', '-q', '-m', 'main', 'trunk');
    write(repo, 'NOTICE');
    commitAll(repo, 'docs: add notice');
    expect(pushScope(repo, 'website', [{base: null}]).output).toBe('run');
  });

  test('skips a push that only deletes', () => {
    const repo = scopeRepo();
    expect(pushScope(repo, 'tooling', [{deleted: true}]).output).toBe('skip');
  });

  test('refuses uncommitted tracked changes, even to the policy', () => {
    for (const file of ['scripts/notes.txt', 'scripts/checks/ciPolicy.ts']) {
      const repo = scopeRepo();
      write(repo, 'terraform/main.tf');
      commitAll(repo, 'chore: add terraform');
      appendFileSync(path.join(repo, file), '\n');
      const result = pushScope(repo, 'tooling');
      expect(result.exitCode).toBe(1);
      expect(result.output).toBe('');
      expect(result.stderr).toContain('Uncommitted changes');
    }
  });

  test('refuses to vouch for a pushed commit other than HEAD', () => {
    const repo = scopeRepo();
    write(repo, 'terraform/main.tf');
    commitAll(repo, 'chore: add terraform');
    const pushed = git(repo, 'rev-parse', 'HEAD');
    commitAll(repo, 'chore: later work');
    const result = pushScope(repo, 'terraform', [{localOid: pushed}]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('checks the checked-out commit');
  });

  test('refuses untracked files only in a scope that runs', () => {
    const repo = scopeRepo();
    appendFileSync(path.join(repo, 'scripts/notes.txt'), 'more\n');
    commitAll(repo, 'chore: edit notes');
    write(repo, 'scripts/stray.test.ts');
    write(repo, 'terraform/stray.tf');
    const tooling = pushScope(repo, 'tooling');
    expect(tooling.exitCode).toBe(1);
    expect(tooling.stderr).toContain('scripts/stray.test.ts');
    expect(tooling.stderr).not.toContain('terraform/stray.tf');
    expect(pushScope(repo, 'terraform').output).toBe('skip');
  });

  test('fails without push data or with an unknown scope', () => {
    const repo = scopeRepo();
    const unset = run(['bun', 'scripts/checks/pushScope.ts', 'tooling'], repo, {
      AGENT_TOOL_PUSH_GATE: '',
    });
    expect(unset.exitCode).toBe(1);
    expect(unset.stderr).toContain('AGENT_TOOL_PUSH_GATE is unset');
    const unknown = pushScope(repo, 'tests');
    expect(unknown.exitCode).toBe(1);
    expect(unknown.stderr).toContain("Unknown scope 'tests'");
  });
});

interface PushGateStep {
  label: string;
  command: string[];
}

const STEPS = (
  JSON.parse(readFileSync(path.join(REPO_ROOT, 'agent-tool.json'), 'utf8')) as {
    pushGate: {steps: PushGateStep[]};
  }
).pushGate.steps;

describe('the scoped push-gate steps', () => {
  /**
   * A repository whose root and package scripts, and `terraform`, only
   * report that a check ran.
   */
  function stubbedRepo(): {repo: string; env: Record<string, string>} {
    const stub = 'echo CHECK-RAN';
    const bin = tempDir();
    writeFileSync(path.join(bin, 'terraform'), `#!/bin/sh\n${stub}\n`);
    chmodSync(path.join(bin, 'terraform'), 0o755);
    const repo = scopeRepo(repo => {
      const scripts = (names: string[]) =>
        JSON.stringify({
          scripts: Object.fromEntries(names.map(n => [n, stub])),
        });
      write(repo, 'package.json', scripts(['lint', 'lint:shell', 'typecheck']));
      for (const dir of ['api-shared', 'backend-v2', 'website']) {
        write(
          repo,
          `packages/${dir}/package.json`,
          scripts(['lint', 'typecheck', 'check'])
        );
      }
    });
    return {repo, env: {PATH: `${bin}:${process.env['PATH']}`}};
  }

  function runSteps(repo: string, env: Record<string, string>) {
    const AGENT_TOOL_PUSH_GATE = pushData(repo);
    return STEPS.map(step => ({
      label: step.label,
      ...run(step.command, repo, {...env, AGENT_TOOL_PUSH_GATE}),
    }));
  }

  test('every step is guarded by a scope', () => {
    for (const step of STEPS) {
      expect(step.command.join(' ')).toMatch(
        /^sh -ec scope=\$\(bun scripts\/checks\/pushScope\.ts \w+\); \[ "\$scope" = skip \] \|\| /
      );
    }
  });

  test('a push that changes no scope runs no check', () => {
    const {repo, env} = stubbedRepo();
    write(repo, 'NOTICE');
    commitAll(repo, 'docs: add notice');
    for (const step of runSteps(repo, env)) {
      expect(step).toMatchObject({exitCode: 0, stdout: ''});
    }
  });

  test('a push that changes every scope runs every check', () => {
    const {repo, env} = stubbedRepo();
    write(repo, '.mise.toml');
    commitAll(repo, 'build: add the toolchain');
    for (const step of runSteps(repo, env)) {
      expect(step).toMatchObject({exitCode: 0});
      expect(step.stdout).toContain('CHECK-RAN');
    }
  });

  test('a step fails without its check when its scope cannot be told', () => {
    const {repo, env} = stubbedRepo();
    write(repo, '.mise.toml');
    commitAll(repo, 'build: add the toolchain');
    appendFileSync(path.join(repo, '.mise.toml'), 'edit\n');
    for (const step of runSteps(repo, env)) {
      expect(step.exitCode).not.toBe(0);
      expect(step.stdout).not.toContain('CHECK-RAN');
    }
  });
});
