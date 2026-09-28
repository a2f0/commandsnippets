// @vitest-environment node
import {spawnSync} from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, expect, it} from 'vitest';

// `bun run compile` must never need a manual clean of `.ts-out`: after a pull
// or checkout, its output must match the sources. TypeScript 7.0.2's
// incremental builder skips re-emitting the declarations of unchanged files
// when the same build also changes a global declaration file
// (microsoft/typescript-go#4664), so AppContext.d.ts, which inlines the
// store's model types, kept the old types. This runs the script in a copy of
// the package, across such a change and back.
const root = fileURLToPath(new URL('../..', import.meta.url));
const SKIPPED = new Set([
  'node_modules',
  '.ts-out',
  'build',
  'dist',
  'dev-dist',
  'logs',
  '.wrangler',
  '_results_',
]);
let dir = '';

const compile = () => {
  const result = spawnSync('bun', ['run', 'compile'], {
    cwd: dir,
    encoding: 'utf8',
  });
  return {status: result.status, output: result.stdout + result.stderr};
};
const read = (path: string) => readFileSync(join(dir, path), 'utf8');
const replaceIn = (path: string, from: string, to: string) => {
  const text = read(path);
  expect(text.includes(from), `${path} holds ${from}`).toBe(true);
  writeFileSync(join(dir, path), text.replace(from, to));
};

const TAG_MODEL = 'src/lib/store/models/TagModel.ts';
const FIELD = 'is_deleted: types.boolean,';
const PROBE = 'compile_probe: types.maybe(types.string),';
// AppContext.d.ts inlines the whole store type, the models' fields included.
const contextDeclaresProbe = () =>
  read('.ts-out/src/AppContext.d.ts').includes('compile_probe');

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'app-compile-'));
  cpSync(root, dir, {
    recursive: true,
    filter: source => !SKIPPED.has(relative(root, source).split('/')[0] ?? ''),
  });
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
});

afterAll(() => {
  rmSync(dir, {recursive: true, force: true});
});

it('keeps the declarations current across a model and global type change', () => {
  let result = compile();
  expect(result.status, result.output).toBe(0);
  expect(contextDeclaresProbe()).toBe(false);

  // A model field and a global declaration file change together, as when
  // checking out another commit.
  replaceIn(TAG_MODEL, FIELD, `${FIELD}\n        ${PROBE}`);
  appendFileSync(join(dir, 'types/window.d.ts'), '\n// changed\n');
  result = compile();
  expect(result.status, result.output).toBe(0);
  expect(contextDeclaresProbe(), 'AppContext.d.ts is current').toBe(true);

  // And back.
  replaceIn(TAG_MODEL, `\n        ${PROBE}`, '');
  replaceIn('types/window.d.ts', '\n// changed\n', '');
  result = compile();
  expect(result.status, result.output).toBe(0);
  expect(contextDeclaresProbe(), 'AppContext.d.ts is current').toBe(false);
}, 180_000);
