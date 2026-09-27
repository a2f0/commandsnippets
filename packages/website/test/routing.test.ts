import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {type ChildProcess, spawn} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {request} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// The real routing (static assets first, then the Worker), through
// `wrangler dev` on a production build. Browsers send `Sec-Fetch-Mode:
// navigate` for bookmarks, which asset serving can treat differently, so
// every case runs both with and without it.
const root = join(import.meta.dir, '..');
const wrangler = join(root, 'node_modules', '.bin', 'wrangler');
let outDir = '';
let port = 0;
let server: ChildProcess | undefined;

const get = (path: string, navigate: boolean) =>
  new Promise<{
    status: number;
    location: string | undefined;
    contentType: string | undefined;
  }>((resolve, reject) => {
    const headers: Record<string, string> = navigate
      ? {'Sec-Fetch-Mode': 'navigate', Accept: 'text/html'}
      : {};
    request({host: '127.0.0.1', port, path, headers}, response => {
      response.resume();
      resolve({
        status: response.statusCode ?? 0,
        location: response.headers.location,
        contentType: response.headers['content-type'],
      });
    })
      .on('error', reject)
      .end();
  });

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'website-routing-'));
  const build = Bun.spawnSync(
    ['bunx', 'astro', 'build', '--mode', 'production', '--outDir', outDir],
    {cwd: root, stdout: 'pipe', stderr: 'pipe'}
  );
  if (build.exitCode !== 0) {
    throw new Error(build.stderr.toString());
  }
  const probe = Bun.serve({port: 0, fetch: () => new Response()});
  port = probe.port ?? 0;
  probe.stop(true);
  // Its own process group, so the workerd children stop with it.
  server = spawn(
    wrangler,
    [
      'dev',
      '--env',
      'production',
      '--ip',
      '127.0.0.1',
      '--port',
      String(port),
      '--assets',
      outDir,
      '--show-interactive-dev-session=false',
      '--log-level',
      'error',
    ],
    {cwd: root, detached: true, stdio: 'ignore'}
  );
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      await get('/', false);
      break;
    } catch (error) {
      if (Date.now() > deadline) {
        throw error;
      }
      await Bun.sleep(250);
    }
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
  rmSync(outDir, {recursive: true, force: true});
});

describe.each([false, true])('with navigate=%s', navigate => {
  test.each(['/', '/privacy/', '/terms/', '/favicon.svg'])(
    'serves %s from the build',
    async path => {
      expect((await get(path, navigate)).status).toBe(200);
    }
  );

  test.each([
    '/dan',
    '/dan/kubernetes',
    '/dan/kubernetes?search=pods',
    '/oauth/github?code=abc&state=xyz',
  ])('sends %s to the app', async path => {
    expect(await get(path, navigate)).toMatchObject({
      status: 302,
      location: `https://app.commandsnippets.com${path}`,
    });
  });
});

// Browsers that ran the old app still have its service worker and check
// /sw.js for updates. A redirect would fail that check and keep the old worker,
// so the replacement must be served here, as a script.
test('serves the service worker replacement', async () => {
  const {status, location, contentType} = await get('/sw.js', false);
  expect({status, location}).toEqual({status: 200, location: undefined});
  expect(contentType).toMatch(/^(application|text)\/javascript/);
});
