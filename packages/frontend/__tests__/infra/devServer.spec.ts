// @vitest-environment node
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {join, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer, type ViteDevServer} from 'vite';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

// The dev server listens on every interface (`host: true`), so it may serve
// files only from this package, the API contract it links, the workspace's
// package store and the brand sources: never the rest of the workspace,
// which holds other packages' secrets (backend-v2's .dev.vars).
const root = fileURLToPath(new URL('../..', import.meta.url));
const repo = fileURLToPath(new URL('../../../..', import.meta.url));
const ALLOWED = [
  'packages/frontend',
  'packages/api-shared',
  'node_modules',
  'assets/brand',
].map(dir => realpathSync(join(repo, dir)));

/** The symlinks directly in a node_modules directory, scoped ones included. */
function links(modules: string): string[] {
  if (!existsSync(modules)) {
    return [];
  }
  return readdirSync(modules, {withFileTypes: true}).flatMap(entry => {
    const path = join(modules, entry.name);
    if (entry.isSymbolicLink()) {
      return [path];
    }
    if (entry.name.startsWith('@') && entry.isDirectory()) {
      return readdirSync(path, {withFileTypes: true})
        .filter(scoped => scoped.isSymbolicLink())
        .map(scoped => join(path, scoped.name));
    }
    return [];
  });
}

describe('the dev server', () => {
  let server: ViteDevServer | undefined;
  let origin = '';
  // Secrets inside an allowed directory, and a link from there to another
  // package, as a workspace link would be.
  let scratch = '';

  beforeAll(async () => {
    scratch = mkdtempSync(join(root, 'node_modules', '.dev-server-test-'));
    writeFileSync(join(scratch, '.dev.vars'), 'SECRET=1\n');
    mkdirSync(join(scratch, '.secrets'));
    writeFileSync(join(scratch, '.secrets', 'prod'), 'SECRET=1\n');
    symlinkSync(join(repo, 'packages', 'backend-v2'), join(scratch, 'backend'));
    server = await createServer({
      root,
      configFile: `${root}vite.config.ts`,
      logLevel: 'silent',
      server: {host: '127.0.0.1', port: 0, strictPort: false, hmr: false},
    });
    await server.listen();
    const address = server.httpServer?.address();
    origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  }, 60_000);

  afterAll(async () => {
    await server?.close();
    if (scratch) {
      rmSync(scratch, {recursive: true, force: true});
    }
  });

  const status = async (path: string) =>
    (await fetch(`${origin}/@fs${path}`)).status;

  it.each([
    'package.json',
    'packages/backend-v2/package.json',
    'packages/backend-v2/wrangler.jsonc',
    'packages/website/package.json',
  ])('refuses %s, outside its allow list', async file => {
    expect(await status(join(repo, file))).toBe(403);
  });

  it.each(['assets/brand/logo.svg', 'packages/api-shared/src/datetime.ts'])(
    'serves %s',
    async file => {
      expect(await status(join(repo, file))).toBe(200);
    }
  );

  it.each(['.dev.vars', '.secrets/prod', 'backend/.dev.vars.example'])(
    'refuses %s inside an allowed directory, links included',
    async file => {
      expect(await status(join(scratch, file))).toBe(403);
    }
  );

  // Vite checks the requested path, not where a link leads, so no installed
  // link may lead out of the allowed directories.
  it('has no installed link that leads outside its allow list', () => {
    const store = join(repo, 'node_modules', '.bun');
    const modules = [
      join(root, 'node_modules'),
      join(repo, 'packages', 'api-shared', 'node_modules'),
      join(repo, 'node_modules'),
      join(store, 'node_modules'),
      ...readdirSync(store).map(entry => join(store, entry, 'node_modules')),
    ];
    const installed = modules.flatMap(links);
    expect(installed.length).toBeGreaterThan(0);
    const outside = installed.filter(link => {
      const target = realpathSync(link);
      return !ALLOWED.some(
        dir => target === dir || target.startsWith(dir + sep)
      );
    });
    expect(outside).toEqual([]);
  });
});
