// @vitest-environment node
import {type ChildProcess, spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import {type IncomingHttpHeaders, request} from 'node:http';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';

// The deployed hosting, end to end: a real build served by `wrangler dev` with
// wrangler.jsonc (single-page-app fallback) and public/_headers, with the
// icons the build scripts render into public/ first (`bun run images`).
const root = fileURLToPath(new URL('../..', import.meta.url));
const bin = (name: string) => join(root, 'node_modules', '.bin', name);
let outDir = '';
let port = 0;
let server: ChildProcess | undefined;

type Result = {status: number; headers: IncomingHttpHeaders};
const get = (path: string, navigate = false) =>
  new Promise<Result>((resolve, reject) => {
    const headers: Record<string, string> = navigate
      ? {'Sec-Fetch-Mode': 'navigate', Accept: 'text/html'}
      : {};
    request({host: '127.0.0.1', port, path, headers}, response => {
      response.resume();
      resolve({
        status: response.statusCode ?? 0,
        headers: response.headers,
      });
    })
      .on('error', reject)
      .end();
  });

const freePort = () =>
  new Promise<number>(resolve => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() =>
        resolve(typeof address === 'object' && address ? address.port : 0)
      );
    });
  });

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'app-hosting-'));
  const images = spawnSync('bun', ['run', 'images'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (images.status !== 0) {
    throw new Error(images.stderr || images.stdout);
  }
  const build = spawnSync(
    bin('vite'),
    ['build', '--mode', 'staging', '--outDir', outDir, '--emptyOutDir'],
    {cwd: root, encoding: 'utf8'}
  );
  if (build.status !== 0) {
    throw new Error(build.stderr || build.stdout);
  }
  port = await freePort();
  // Its own process group, so the workerd children stop with it.
  server = spawn(
    bin('wrangler'),
    [
      'dev',
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
      await get('/');
      break;
    } catch (error) {
      if (Date.now() > deadline) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
}, 180_000);

afterAll(async () => {
  const pid = server?.pid;
  if (server !== undefined && pid !== undefined) {
    const exited = new Promise(resolve => server?.once('exit', resolve));
    process.kill(-pid, 'SIGTERM');
    const timeout = new Promise(resolve =>
      setTimeout(() => resolve('timeout'), 5_000)
    );
    if ((await Promise.race([exited, timeout])) === 'timeout') {
      process.kill(-pid, 'SIGKILL');
    }
  }
  rmSync(outDir, {recursive: true, force: true});
});

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};

describe.each([false, true])('with navigate=%s', navigate => {
  it.each(['/', '/dan', '/dan/kubernetes', '/admin'])(
    'serves the app shell for %s with the security headers',
    async path => {
      const response = await get(path, navigate);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers).toMatchObject(SECURITY_HEADERS);
      // The shell must revalidate, or a deploy would not reach returning users.
      expect(response.headers['cache-control'] ?? '').not.toContain(
        'immutable'
      );
    }
  );
});

it('caches fingerprinted assets for a year, immutably', async () => {
  const [asset] = readdirSync(join(outDir, 'assets')).filter(name =>
    name.endsWith('.js')
  );
  expect(asset).toBeDefined();
  const response = await get(`/assets/${asset}`);
  expect(response.status).toBe(200);
  expect(response.headers['cache-control']).toBe(
    'public, max-age=31536000, immutable'
  );
  expect(response.headers).toMatchObject(SECURITY_HEADERS);
});

// The single-page-app fallback answers a missing file with the shell, so an
// icon must come back as an image, not just with a 200.
it.each(['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png'])(
  'serves the icon %s',
  async path => {
    const response = await get(path);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^image\//);
  }
);

it('links the icons from the app shell and serves every manifest icon', async () => {
  // The build minifies index.html, so match each tag however it closes.
  const html = readFileSync(join(outDir, 'index.html'), 'utf8');
  expect(html).toMatch(
    /<link rel="icon" href="\/favicon\.ico" sizes="any"\s*\/?>/
  );
  expect(html).toMatch(
    /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"\s*\/?>/
  );
  expect(html).toMatch(
    /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"\s*\/?>/
  );
  const manifest: {icons: {src: string; type: string}[]} = JSON.parse(
    readFileSync(join(outDir, 'manifest.webmanifest'), 'utf8')
  );
  expect(manifest.icons.map(icon => icon.src)).toEqual([
    'pwa-192x192.png',
    'pwa-512x512.png',
    'favicon.svg',
  ]);
  for (const icon of manifest.icons) {
    const response = await get(`/${icon.src}`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain(icon.type);
  }
});
