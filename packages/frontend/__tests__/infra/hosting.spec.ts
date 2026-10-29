// @vitest-environment node
import {type ChildProcess, spawn, spawnSync} from 'node:child_process';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import {type IncomingHttpHeaders, request} from 'node:http';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {remote} from 'webdriverio';

// The deployed hosting, end to end: a real build of each environment served
// by `wrangler dev` with wrangler.jsonc (single-page-app fallback) and
// public/_headers, with the icons the build scripts render into public/ first
// (`bun run images`).
const root = fileURLToPath(new URL('../..', import.meta.url));
const bin = (name: string) => join(root, 'node_modules', '.bin', name);

const freePort = () =>
  new Promise<number>(resolve => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() =>
        resolve(typeof address === 'object' && address ? address.port : 0)
      );
    });
  });

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};

beforeAll(() => {
  const images = spawnSync('bun', ['run', 'images'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (images.status !== 0) {
    throw new Error(images.stderr || images.stdout);
  }
}, 60_000);

describe.each(['staging', 'production'])('the %s build', mode => {
  let outDir = '';
  let port = 0;
  let server: ChildProcess | undefined;
  // Only production's root may be indexed (the sign-in page): staging says
  // noindex on every response, and production on every page below the root,
  // users' public pages (/:user/:tag) among them, but not on its files.
  const robots = mode === 'production' ? undefined : 'noindex, nofollow';
  const NOINDEX = ['noindex, nofollow'];
  /** Each X-Robots-Tag the tier sends: none, or one; never two. */
  const tierRobots = robots === undefined ? [] : [robots];

  type Result = {
    status: number;
    headers: IncomingHttpHeaders;
    /** Every X-Robots-Tag header line, as sent (Node joins repeats). */
    robotsTags: string[];
  };
  const get = (path: string, navigate = false) =>
    new Promise<Result>((resolve, reject) => {
      const headers: Record<string, string> = navigate
        ? {'Sec-Fetch-Mode': 'navigate', Accept: 'text/html'}
        : {};
      request({host: '127.0.0.1', port, path, headers}, response => {
        response.resume();
        const raw = response.rawHeaders;
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          robotsTags: raw.filter(
            (_value, index) =>
              index % 2 === 1 &&
              raw[index - 1]?.toLowerCase() === 'x-robots-tag'
          ),
        });
      })
        .on('error', reject)
        .end();
    });

  beforeAll(async () => {
    outDir = mkdtempSync(join(tmpdir(), `app-hosting-${mode}-`));
    const build = spawnSync(
      bin('vite'),
      ['build', '--mode', mode, '--outDir', outDir, '--emptyOutDir'],
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

  it('boots the release bundle on first load and reloads', async () => {
    // Use the deployed hostname so the app selects the real environment,
    // but resolve it only to this test's local hosting server. Other hosts
    // cannot reach the network. Each browser has an empty, temporary profile.
    const hostname =
      mode === 'production'
        ? 'app.commandsnippets.com'
        : 'app-staging.commandsnippets.com';
    const origin = `http://${hostname}:${port}`;
    const browser = await remote({
      logLevel: 'error',
      capabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: [
            '--headless',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--no-proxy-server',
            `--host-resolver-rules=MAP ${hostname} 127.0.0.1, MAP * ~NOTFOUND`,
            `--unsafely-treat-insecure-origin-as-secure=${origin}`,
          ],
        },
      },
    });
    try {
      const errors: string[] = [];
      await browser.sessionSubscribe({events: ['log.entryAdded']});
      browser.on('log.entryAdded', entry => {
        if (entry.type === 'javascript' && entry.level === 'error') {
          errors.push(entry.text ?? 'JavaScript error');
        }
      });
      const rendered = async () => {
        await browser.waitUntil(
          async () =>
            errors.length > 0 || (await browser.$('#signInPage').isDisplayed()),
          {timeout: 10_000}
        );
        expect(errors).toEqual([]);
        expect(await browser.$('#signInPage').isDisplayed()).toBe(true);
      };
      // The service worker's lifecycle as the page sees it, for the waits.
      const serviceWorker = () =>
        browser.execute(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return {
            controlled: navigator.serviceWorker.controller !== null,
            registered: registration !== undefined,
            installing: registration?.installing?.state ?? null,
            waiting: registration?.waiting?.state ?? null,
            active: registration?.active?.state ?? null,
          };
        });
      await browser.url(origin);
      await rendered();
      // Disable the HTTP cache for a reload, then exercise the PWA's normal
      // controlled reload as well. A successful HTTP/build check alone does
      // not catch initialization cycles between emitted JavaScript chunks.
      await browser.networkSetCacheBehavior({cacheBehavior: 'bypass'});
      await browser.refresh();
      await rendered();
      // Wait for the worker to activate, not for it to control this page:
      // whether its clientsClaim reaches a page loaded while it installed is
      // a race. Every navigation after activation is controlled.
      let lifecycle = await serviceWorker();
      await browser
        .waitUntil(
          async () => {
            lifecycle = await serviceWorker();
            return lifecycle.active === 'activated';
          },
          {timeout: 10_000}
        )
        .catch((error: unknown) => {
          throw new Error(
            `the service worker never activated: ${JSON.stringify(lifecycle)}`,
            {cause: error}
          );
        });
      await browser.networkSetCacheBehavior({cacheBehavior: 'default'});
      await browser.refresh();
      await rendered();
      expect(await serviceWorker()).toMatchObject({controlled: true});
    } finally {
      await browser.deleteSession();
    }
  }, 90_000);

  describe.each([false, true])('with navigate=%s', navigate => {
    // The root, then users' pages (each also with the trailing slash the
    // router ignores), the app's own routes, and a path of no route, which
    // the app sends to the root.
    it.each([
      ['/', tierRobots],
      ['/dan', NOINDEX],
      ['/dan/', NOINDEX],
      ['/dan/kubernetes', NOINDEX],
      ['/dan/kubernetes/', NOINDEX],
      ['/admin', NOINDEX],
      ['/oauth/github', NOINDEX],
      ['/oauth/google', NOINDEX],
      ['/dan/kubernetes/more', NOINDEX],
    ])(
      'serves the app shell for %s with the security headers',
      async (path, robotsTags) => {
        const response = await get(path, navigate);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/html');
        expect(response.headers).toMatchObject(SECURITY_HEADERS);
        expect(response.robotsTags).toEqual(robotsTags);
        // The shell must revalidate, or a deploy would not reach returning users.
        expect(response.headers['cache-control'] ?? '').not.toContain(
          'immutable'
        );
      }
    );
  });

  // `/:user` matches every top-level file too, and `/:user/*` every asset:
  // each detaches the header again, which only works after those rules.
  it("sends each of the build's files the tier's robots header", async () => {
    const files = readdirSync(outDir, {recursive: true, encoding: 'utf8'})
      .filter(file => statSync(join(outDir, file)).isFile())
      .filter(file => file !== '_headers');
    expect(files).toEqual(
      expect.arrayContaining(['favicon.ico', 'robots.txt', 'sw.js'])
    );
    expect(files.some(file => file.startsWith('assets/'))).toBe(true);
    for (const file of files) {
      const response = await get(`/${file}`);
      // index.html redirects to the root.
      expect([200, 307], file).toContain(response.status);
      expect(response.robotsTags, file).toEqual(tierRobots);
    }
  });

  // Only the files are detached, not their directory: `assets` is a
  // username like any other (routePaths.ts).
  it('keeps the pages of a user named assets out of search', async () => {
    const response = await get('/assets/kubernetes', true);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.robotsTags).toEqual(NOINDEX);
  });

  // Without the file, the app's fallback would answer robots.txt with HTML.
  it('serves robots.txt as text, allowing crawlers to see the noindex', async () => {
    const response = await get('/robots.txt');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.robotsTags).toEqual(tierRobots);
    expect(readFileSync(join(outDir, 'robots.txt'), 'utf8')).toBe(
      'User-agent: *\nAllow: /\n'
    );
  });

  it('describes the app, and says noindex outside production', () => {
    const html = readFileSync(join(outDir, 'index.html'), 'utf8');
    expect(html).toMatch(/<title>Command Snippets – [^<]+<\/title>/);
    expect(html).toMatch(/<meta name="description" content="[^"]{120,160}"\/>/);
    expect(html).toContain(
      '<meta property="og:title" content="Command Snippets'
    );
    expect(html.match(/<meta name="robots" content="([^"]*)"/)?.[1]).toBe(
      robots
    );
    // Users' public pages share this page; naming the root would mark them
    // duplicates of it (index.html).
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('og:url');
  });

  // Every build names production's copy of the image the website renders
  // into its public/ (the `social` target in agent-tool.json).
  it('names the product preview image for the large card', () => {
    const html = readFileSync(join(outDir, 'index.html'), 'utf8');
    const meta = (key: string) =>
      html.match(
        new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`)
      )?.[1];
    expect(meta('og:image')).toBe('https://commandsnippets.com/og-image.png');
    expect(meta('og:image:width')).toBe('1200');
    expect(meta('og:image:height')).toBe('630');
    expect(meta('og:image:alt')).toBe('The Command Snippets logo');
    expect(meta('twitter:card')).toBe('summary_large_image');
    const images: {
      images: {
        targets: Record<
          string,
          {dir?: string; outputs: {path: string; size?: unknown}[]}
        >;
      };
    } = JSON.parse(readFileSync(join(root, '../../agent-tool.json'), 'utf8'));
    const social = images.images.targets['social'];
    expect(social?.dir).toBe('packages/website/public');
    expect(social?.outputs).toContainEqual(
      expect.objectContaining({path: 'og-image.png', size: [1200, 630]})
    );
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
    expect(response.robotsTags).toEqual(tierRobots);
  });
});
