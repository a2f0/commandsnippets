import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {type ChildProcess, spawn} from 'node:child_process';
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

// `astro dev` serves files only from this package, the workspace's package
// store and the brand sources (astro.config.mjs): never the rest of the
// workspace, which holds other packages' secrets (backend-v2's .dev.vars).
const root = join(import.meta.dir, '..');
const repo = join(root, '..', '..');
const astro = join(root, 'node_modules', '.bin', 'astro');
const ALLOWED = ['packages/website', 'node_modules', 'assets/brand'].map(dir =>
  realpathSync(join(repo, dir))
);

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
  let port = 0;
  let server: ChildProcess | undefined;
  // Secrets inside an allowed directory, and a link from there to another
  // package, as a workspace link would be.
  let scratch = '';

  const status = async (path: string) =>
    (await fetch(`http://127.0.0.1:${port}${path}`)).status;

  beforeAll(async () => {
    scratch = mkdtempSync(join(root, 'node_modules', '.dev-server-test-'));
    writeFileSync(join(scratch, '.dev.vars'), 'SECRET=1\n');
    mkdirSync(join(scratch, '.secrets'));
    writeFileSync(join(scratch, '.secrets', 'prod'), 'SECRET=1\n');
    symlinkSync(join(repo, 'packages', 'backend-v2'), join(scratch, 'backend'));
    const probe = Bun.serve({port: 0, fetch: () => new Response()});
    port = probe.port ?? 0;
    probe.stop(true);
    // In the foreground, in its own process group so its children stop with
    // it: --ignore-lock also stops Astro from moving to the background when
    // it detects a coding agent, and from writing its lock file.
    server = spawn(
      astro,
      ['dev', '--ignore-lock', '--host', '127.0.0.1', '--port', String(port)],
      {cwd: root, detached: true, stdio: 'ignore'}
    );
    const deadline = Date.now() + 60_000;
    for (;;) {
      try {
        if ((await status('/')) === 200) {
          break;
        }
      } catch (error) {
        if (Date.now() > deadline) {
          throw error;
        }
      }
      if (Date.now() > deadline) {
        throw new Error('astro dev did not start');
      }
      await Bun.sleep(250);
    }
  }, 120_000);

  afterAll(async () => {
    const pid = server?.pid;
    if (server !== undefined && pid !== undefined) {
      const exited = new Promise(resolve => server?.once('exit', resolve));
      process.kill(-pid, 'SIGTERM');
      const timeout = Bun.sleep(5_000).then(() => 'timeout');
      if ((await Promise.race([exited, timeout])) === 'timeout') {
        process.kill(-pid, 'SIGKILL');
      }
    }
    if (scratch) {
      rmSync(scratch, {recursive: true, force: true});
    }
  });

  test.each([
    'package.json',
    'packages/backend-v2/package.json',
    'packages/backend-v2/wrangler.jsonc',
    'packages/frontend/package.json',
  ])('refuses %s, outside its allow list', async file => {
    expect(await status(`/@fs${join(repo, file)}`)).toBe(403);
  });

  test('serves the brand sources', async () => {
    expect(await status(`/@fs${join(repo, 'assets/brand/logo.svg')}`)).toBe(
      200
    );
  });

  test.each(['.dev.vars', '.secrets/prod', 'backend/.dev.vars.example'])(
    'refuses %s inside an allowed directory, links included',
    async file => {
      expect(await status(`/@fs${join(scratch, file)}`)).toBe(403);
    }
  );

  // Vite checks the requested path, not where a link leads, so no installed
  // link may lead out of the allowed directories.
  test('has no installed link that leads outside its allow list', () => {
    const store = join(repo, 'node_modules', '.bun');
    const modules = [
      join(root, 'node_modules'),
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
