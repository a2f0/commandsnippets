import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {type ChildProcess, spawn} from 'node:child_process';
import {join} from 'node:path';

// `astro dev` serves files only from this package, the workspace's package
// store and the brand sources (astro.config.mjs): never the rest of the
// workspace, which holds other packages' secrets (backend-v2's .dev.vars).
const root = join(import.meta.dir, '..');
const repo = join(root, '..', '..');
const astro = join(root, 'node_modules', '.bin', 'astro');

describe('the dev server', () => {
  let port = 0;
  let server: ChildProcess | undefined;

  const status = async (path: string) =>
    (await fetch(`http://127.0.0.1:${port}${path}`)).status;

  beforeAll(async () => {
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
});
