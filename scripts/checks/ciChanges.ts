/**
 * Prints which CI scopes a change needs (`ciPolicy.ts`), as `<scope>=<bool>`
 * lines.
 *
 * In CI (no arguments) the change is the pull request's diff from
 * `CI_BASE_SHA` to `CI_HEAD_SHA`, every scope applies without a usable diff,
 * and the lines also go to `GITHUB_OUTPUT`. The pre-push hook passes the
 * pushed commits instead, one `--range <base>...<head>` per ref, and reads the
 * lines from stdout.
 */
import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {allScopes, ciDiffRange, ciScopes} from './ciPolicy';

/**
 * The paths a range changes. `--no-renames` lists both sides of a move, so
 * moving a file out of a checked area still runs that area's checks.
 */
function changedPaths(range: string): string[] {
  return execFileSync(
    'git',
    ['diff', '--name-only', '--no-renames', '-z', range, '--'],
    {encoding: 'utf8'}
  )
    .split('\0')
    .filter(path => path !== '');
}

function scopeLines(scopes: Record<string, boolean>): string {
  return Object.entries(scopes)
    .map(([name, required]) => `${name}=${String(required)}\n`)
    .join('');
}

const {values} = parseArgs({
  options: {range: {type: 'string', multiple: true}},
});

if (values.range) {
  process.stdout.write(
    scopeLines(ciScopes(values.range.flatMap(range => changedPaths(range))))
  );
} else {
  const {
    CI_BASE_SHA: base,
    CI_HEAD_SHA: head,
    GITHUB_OUTPUT: output,
  } = process.env;
  if (!output) throw new Error('GITHUB_OUTPUT is required.');
  const range = ciDiffRange(base, head);
  const scopes = range ? ciScopes(changedPaths(range)) : allScopes();
  appendFileSync(output, scopeLines(scopes));
  for (const [name, required] of Object.entries(scopes)) {
    console.log(`${name}: ${required ? 'required' : 'not affected'}`);
  }
}
