/**
 * Whether a push needs one CI scope's local checks: `bun
 * scripts/checks/pushScope.ts <scope>` prints `run` or `skip`, and fails when
 * it cannot tell. Each scoped step of the push gate (`pushGate` in
 * agent-tool.json) runs it before its check, so a push lints and typechecks
 * only the areas it changes; CI runs the tests and is the authority.
 *
 * agent-tool's push gate writes what is being pushed to the JSON file named by
 * AGENT_TOOL_PUSH_GATE while its declared steps run. The pushed commits are
 * classified as CI classifies a pull request (`ciPolicy.ts`), from each ref's
 * `base` (the remote's old tip, or the newest commit the remote already has),
 * else from where it left `main`; a ref with neither needs every scope.
 *
 * The checks read the working tree, so they vouch for the push only when the
 * tree is the pushed commit: every pushed ref must be HEAD and no tracked file
 * may differ from it, both checked before the policy loads, so an uncommitted
 * edit cannot decide what runs; and a scope that runs must have no untracked
 * file it would check without it being pushed.
 */
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import type {CiScope} from './ciPolicy';

interface PushedRef {
  readonly remoteRef: string;
  readonly localOid: string;
  readonly deleted: boolean;
  readonly base: string | null;
}

interface PushData {
  readonly schemaVersion: number;
  readonly refs: readonly PushedRef[];
}

function git(args: readonly string[]): {status: number | null; stdout: string} {
  const result = spawnSync('git', args, {encoding: 'utf8'});
  if (result.error) throw result.error;
  return {status: result.status, stdout: result.stdout};
}

function gitOutput(args: readonly string[]): string {
  const {status, stdout} = git(args);
  if (status !== 0) throw new Error(`git ${args.join(' ')} failed.`);
  return stdout;
}

function readPush(file: string | undefined): PushData {
  if (!file) {
    throw new Error(
      "AGENT_TOOL_PUSH_GATE is unset; this runs inside agent-tool's push gate."
    );
  }
  const push = JSON.parse(readFileSync(file, 'utf8')) as PushData;
  if (push.schemaVersion !== 1) {
    throw new Error(`Unsupported push data schema ${push.schemaVersion}.`);
  }
  return push;
}

function requireWorktreeIsPush(refs: readonly PushedRef[]): void {
  const head = gitOutput(['rev-parse', 'HEAD']).trim();
  for (const ref of refs) {
    const commit = gitOutput(['rev-parse', `${ref.localOid}^{commit}`]).trim();
    if (commit !== head) {
      throw new Error(
        `The push gate checks the checked-out commit, but ${ref.remoteRef} receives ${commit}. Check out the branch being pushed and push again.`
      );
    }
  }
  const changed = gitOutput(['status', '--porcelain', '--untracked-files=no']);
  if (changed) {
    throw new Error(
      `Uncommitted changes would be checked instead of the pushed commit:\n${changed}`
    );
  }
}

/** The commits a ref adds, as a three-dot range, or null when nothing anchors it. */
function pushRange(ref: PushedRef): string | null {
  let base = ref.base;
  if (!base) {
    const {status, stdout} = git(['merge-base', 'main', ref.localOid]);
    base = status === 0 ? stdout.trim() : null;
  }
  return base ? `${base}...${ref.localOid}` : null;
}

async function pushScope(scope: string | undefined): Promise<'run' | 'skip'> {
  if (!scope) throw new Error('Usage: bun scripts/checks/pushScope.ts <scope>');
  const refs = readPush(process.env['AGENT_TOOL_PUSH_GATE']).refs.filter(
    ref => !ref.deleted
  );
  if (!refs.length) return 'skip';
  requireWorktreeIsPush(refs);
  const [{allScopes, ciScopes}, {changedPaths}] = await Promise.all([
    import('./ciPolicy'),
    import('./ciChanges'),
  ]);
  if (!Object.hasOwn(allScopes(), scope)) {
    throw new Error(
      `Unknown scope '${scope}'; expected one of ${Object.keys(allScopes()).join(', ')}.`
    );
  }
  const name = scope as CiScope;
  const ranges = refs.map(pushRange);
  const known = ranges.filter(range => range !== null);
  const needed =
    known.length === ranges.length
      ? ciScopes(known.flatMap(range => changedPaths(range)))[name]
      : true;
  if (!needed) return 'skip';
  const untracked = gitOutput([
    'ls-files',
    '-z',
    '--others',
    '--exclude-standard',
  ])
    .split('\0')
    .filter(path => path && ciScopes([path])[name]);
  if (untracked.length) {
    throw new Error(
      `Untracked files would be checked with the pushed commit:\n${untracked.join('\n')}`
    );
  }
  return 'run';
}

if (import.meta.main) {
  const scope = process.argv[2];
  try {
    const result = await pushScope(scope);
    console.error(
      result === 'run'
        ? `push-gate: this push changes the ${scope} scope; checking it.`
        : `push-gate: this push leaves the ${scope} scope alone; skipping its check.`
    );
    console.log(result);
  } catch (error) {
    console.error(`push-gate: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}
