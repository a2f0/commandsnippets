import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {appUrl, FOOTER_LINKS} from '../src/lib/appUrl';
import {
  type BuiltPage,
  builtPage,
  indexable,
  modeFiles,
  NOINDEX,
  PREVIEW_IMAGE,
  pageUrl,
  searchable,
  siteOrigin,
} from '../src/lib/site';

const root = join(import.meta.dir, '..');
const PAGES = ['/', ...FOOTER_LINKS.map(link => link.href)];
// The pages with content today. The others are placeholders, which stay out
// of search until they have their copy.
const CONTENT = ['/', '/privacy/'];
const PLACEHOLDERS = ['/terms/', '/contact/', '/about/'];
/** The production `_headers` rules for pages kept out of search. */
const noindexRules = (paths: readonly string[]) =>
  paths
    .toSorted()
    .flatMap(path => [path.slice(0, -1), `${path}*`])
    .map(pattern => `${pattern}\n  X-Robots-Tag: ${NOINDEX}\n`)
    .join('');

/** The `content` of a `<meta>` (by name or property) in built HTML. */
const meta = (html: string, key: string) =>
  html.match(
    new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`)
  )?.[1];
const canonicalOf = (html: string) =>
  html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];

describe('appUrl', () => {
  test('points each build mode at its app', () => {
    expect(appUrl('production')).toBe('https://app.commandsnippets.com');
    expect(appUrl('staging')).toBe('https://app-staging.commandsnippets.com');
    expect(appUrl('development')).toBe('http://localhost:8085');
  });

  // Logging in starts on the app the website links to, and the OAuth state is
  // kept in that origin's sessionStorage, so the API's OAuth callbacks
  // (backend-v2's wrangler.jsonc) must return to the same origin.
  test.each(['staging', 'production'])(
    '%s: the linked app is where OAuth returns',
    mode => {
      const wrangler = JSON.parse(
        readFileSync(join(root, '../backend-v2/wrangler.jsonc'), 'utf8')
          .split('\n')
          .map(line => line.replace(/^\s*\/\/.*$/, ''))
          .join('\n')
      ) as {env: Record<string, {vars: Record<string, string>}>};
      const vars = wrangler.env[mode]?.vars ?? {};
      for (const name of ['GITHUB_REDIRECT_URI', 'GOOGLE_REDIRECT_URI']) {
        expect(new URL(vars[name] ?? '').origin).toBe(appUrl(mode));
      }
    }
  );
});

describe('siteOrigin', () => {
  // The URLs search engines are given must be the hosts the Worker serves.
  test.each(['staging', 'production'])('%s is its wrangler route', mode => {
    const wrangler = JSON.parse(
      readFileSync(join(root, 'wrangler.jsonc'), 'utf8')
        .split('\n')
        .map(line => line.replace(/^\s*\/\/.*$/, ''))
        .join('\n')
    ) as {env: Record<string, {routes: Array<{pattern: string}>}>};
    const [route] = wrangler.env[mode]?.routes ?? [];
    expect(siteOrigin(mode)).toBe(`https://${route?.pattern}`);
  });

  test('only production is indexable', () => {
    expect(indexable('production')).toBe(true);
    for (const mode of ['staging', 'development', 'test']) {
      expect(indexable(mode)).toBe(false);
    }
  });

  test('only production pages with content are searchable', () => {
    expect(searchable('production', false)).toBe(true);
    expect(searchable('production', true)).toBe(false);
    for (const mode of ['staging', 'development', 'test']) {
      expect(searchable(mode, false)).toBe(false);
      expect(searchable(mode, true)).toBe(false);
    }
  });
});

describe('builtPage', () => {
  test.each([
    ['index.html', '/'],
    ['about/index.html', '/about/'],
    ['docs/setup/index.html', '/docs/setup/'],
    ['404.html', '/404'],
  ])('%s is served at %s', (name, path) => {
    expect(builtPage(name, '').path).toBe(path);
  });

  test('reads the canonical URL and the robots meta', () => {
    const indexed =
      '<head><link rel="canonical" href="https://commandsnippets.com/"></head>';
    expect(builtPage('index.html', indexed)).toEqual({
      path: '/',
      canonical: 'https://commandsnippets.com/',
      robots: undefined,
    });
    const kept = `<head><meta name="robots" content="${NOINDEX}"></head>`;
    expect(builtPage('about/index.html', kept)).toEqual({
      path: '/about/',
      canonical: undefined,
      robots: NOINDEX,
    });
  });
});

describe('modeFiles', () => {
  const content = (path: string): BuiltPage => ({
    path,
    canonical: pageUrl('production', path),
    robots: undefined,
  });
  const placeholder = (path: string): BuiltPage => ({
    path,
    canonical: undefined,
    robots: NOINDEX,
  });
  const locs = (files: Record<string, string>) =>
    [...(files['sitemap.xml'] ?? '').matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      match => match[1]
    );

  test('production lists the canonical pages and sends noindex for the rest', () => {
    const files = modeFiles('production', [
      placeholder('/about/'),
      content('/privacy/'),
      content('/'),
      placeholder('/404'),
    ]);
    expect(locs(files)).toEqual([
      'https://commandsnippets.com/',
      'https://commandsnippets.com/privacy/',
    ]);
    // A directory page's header also covers its redirecting forms.
    expect(files._headers).toBe(
      [
        `/404\n  X-Robots-Tag: ${NOINDEX}\n`,
        `/about\n  X-Robots-Tag: ${NOINDEX}\n`,
        `/about/*\n  X-Robots-Tag: ${NOINDEX}\n`,
      ].join('')
    );
  });

  // Nothing but the page's own markup changes when its copy lands.
  test('a placeholder that gets its copy joins the sitemap and loses its header', () => {
    const before = modeFiles('production', [
      content('/'),
      placeholder('/about/'),
    ]);
    expect(locs(before)).toEqual(['https://commandsnippets.com/']);
    expect(before._headers).toBe(noindexRules(['/about/']));
    const after = modeFiles('production', [content('/'), content('/about/')]);
    expect(locs(after)).toEqual([
      'https://commandsnippets.com/',
      'https://commandsnippets.com/about/',
    ]);
    expect(after._headers).toBeUndefined();
  });

  test('the home page cannot be kept out of search', () => {
    expect(() => modeFiles('production', [placeholder('/')])).toThrow();
  });

  // Staging's one rule already covers every page; another would repeat it.
  test('staging sends one noindex rule for every file and no sitemap', () => {
    const files = modeFiles('staging', [content('/'), placeholder('/about/')]);
    expect(files).toEqual({
      'robots.txt': 'User-agent: *\nAllow: /\n',
      _headers: `/*\n  X-Robots-Tag: ${NOINDEX}\n`,
    });
  });
});

// Build the real site per mode and check the HTML it produces.
describe.each(['staging', 'production'] as const)('the %s build', mode => {
  let outDir = '';
  const page = (path: string) =>
    readFileSync(join(outDir, path, 'index.html'), 'utf8');
  const file = (path: string) => join(outDir, path);

  beforeAll(() => {
    outDir = mkdtempSync(join(tmpdir(), `website-${mode}-`));
    const result = Bun.spawnSync(
      ['bunx', 'astro', 'build', '--mode', mode, '--outDir', outDir],
      {cwd: root, stdout: 'pipe', stderr: 'pipe'}
    );
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.toString() || result.stdout.toString());
    }
  }, 120_000);

  afterAll(() => {
    rmSync(outDir, {recursive: true, force: true});
  });

  test('home page has the tagline and links to the app', () => {
    const html = page('');
    expect(html).toContain('Solve, Curate, Retrieve.');
    expect(html).toContain('id="tagLine"');
    expect(html).toContain(`id="loginLink" href="${appUrl(mode)}">App</a>`);
    expect(html).toContain(`href="${appUrl(mode)}">Get started</a>`);
  });

  test('every built page initializes the bundled CT browser integration', () => {
    for (const path of ['', ...FOOTER_LINKS.map(link => link.href)]) {
      const script = page(path).match(
        /<script type="module" src="(\/_astro\/[^"]+\.js)"><\/script>/
      )?.[1];
      expect(script).toBeDefined();
      const source = readFileSync(join(outDir, script ?? ''), 'utf8');
      expect(source).toContain('https://ct.a2f0.net/v1/clicks');
      expect(source).toContain(
        mode === 'production'
          ? 'https://commandsnippets.com'
          : 'https://website-staging.commandsnippets.com'
      );
      expect(source).toContain('website');
    }
  });

  test('every footer link has a page', () => {
    for (const link of FOOTER_LINKS) {
      const html = page(link.href);
      expect(html).toContain(`<h1>${link.text}</h1>`);
      if (link.href !== '/privacy/') {
        expect(html).toContain('This page is coming soon.');
      }
      expect(page('')).toContain(`href="${link.href}"`);
    }
  });

  // The icons are rendered into public/ by `bun run images`, which `test`
  // and the build scripts run first.
  test('ships the icons and links them from every page', () => {
    for (const icon of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png']) {
      expect(existsSync(join(outDir, icon))).toBe(true);
    }
    for (const path of ['', ...FOOTER_LINKS.map(link => link.href)]) {
      const html = page(path);
      expect(html).toMatch(
        /<link rel="icon" href="\/favicon\.ico" sizes="any"\s*\/?>/
      );
      expect(html).toMatch(
        /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"\s*\/?>/
      );
      expect(html).toMatch(
        /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"\s*\/?>/
      );
    }
  });

  // Rendered into public/ by `bun run images` (the `social` target).
  test('ships the preview image at the size the pages declare', () => {
    const png = readFileSync(file(PREVIEW_IMAGE.path));
    // The PNG signature, then the IHDR chunk's width and height.
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(PREVIEW_IMAGE.width);
    expect(png.readUInt32BE(20)).toBe(PREVIEW_IMAGE.height);
  });

  test('discloses the analytics operator', () => {
    for (const path of ['', ...FOOTER_LINKS.map(link => link.href)]) {
      if (path !== '/privacy/') {
        expect(page(path).toLowerCase()).not.toContain('tearleads');
      }
    }
    expect(page('/privacy/')).toContain('Tearleads, LLC');
    expect(page('/privacy/')).toContain('Do Not Track');
    expect(page('/privacy/')).toContain('Global Privacy Control');
    expect(page('/privacy/')).toContain(
      'https://github.com/a2f0/ct/blob/main/packages/extension/README.md'
    );
  });

  test('every page has its own title, description and canonical URL', () => {
    const titles = new Set<string>();
    for (const path of PAGES) {
      const html = page(path);
      const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
      expect(title).toEndWith('Commandsnippets');
      titles.add(title);
      expect(html).toStartWith('<!DOCTYPE html><html lang="en">');
      expect(html).toContain('<meta name="viewport"');
      expect(meta(html, 'description')?.length).toBeGreaterThan(50);
      expect(meta(html, 'theme-color')).toBeDefined();
      // A noindexed page names no URL for search engines.
      const url = searchable(mode, PLACEHOLDERS.includes(path))
        ? pageUrl(mode, path)
        : undefined;
      expect(canonicalOf(html)).toBe(url);
      expect(meta(html, 'og:url')).toBe(url);
      expect(meta(html, 'og:title')).toBe(title);
      expect(meta(html, 'og:description')).toBe(meta(html, 'description'));
      expect(meta(html, 'og:site_name')).toBe('Commandsnippets');
      expect(meta(html, 'og:type')).toBe('website');
      // The large card, with this build's own absolute image URL.
      expect(meta(html, 'og:image')).toBe(
        `${siteOrigin(mode)}${PREVIEW_IMAGE.path}`
      );
      expect(meta(html, 'og:image:width')).toBe('1200');
      expect(meta(html, 'og:image:height')).toBe('630');
      expect(meta(html, 'og:image:alt')).toBe(PREVIEW_IMAGE.alt);
      expect(meta(html, 'twitter:card')).toBe('summary_large_image');
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    }
    expect(titles.size).toBe(PAGES.length);
  });

  test(
    mode === 'production'
      ? 'pages with content may be indexed; placeholders and their headers say noindex'
      : 'pages and their headers say noindex',
    () => {
      expect([...CONTENT, ...PLACEHOLDERS].toSorted()).toEqual(
        PAGES.toSorted()
      );
      for (const path of PAGES) {
        const html = page(path);
        // Placeholder.astro is what keeps a page out of search.
        expect(html.includes('data-placeholder')).toBe(
          PLACEHOLDERS.includes(path)
        );
        const robots = searchable(mode, PLACEHOLDERS.includes(path))
          ? undefined
          : NOINDEX;
        expect(meta(html, 'robots')).toBe(robots);
        expect(html.match(/<meta name="robots"/g)?.length ?? 0).toBe(
          robots === undefined ? 0 : 1
        );
      }
      expect(readFileSync(file('_headers'), 'utf8')).toBe(
        mode === 'production'
          ? noindexRules(PLACEHOLDERS)
          : `/*\n  X-Robots-Tag: ${NOINDEX}\n`
      );
    }
  );

  test('only the production home page has JSON-LD, in its head', () => {
    const head = page('').match(/<head>.*<\/head>/s)?.[0] ?? '';
    const json = head.match(
      /<script type="application\/ld\+json">([^<]*)<\/script>/
    )?.[1];
    if (mode !== 'production') {
      expect(json).toBeUndefined();
      return;
    }
    const data = JSON.parse(json ?? '') as {
      '@context': string;
      '@graph': Array<Record<string, unknown>>;
    };
    expect(data['@context']).toBe('https://schema.org');
    const byType = new Map(data['@graph'].map(node => [node['@type'], node]));
    expect([...byType.keys()]).toEqual([
      'Organization',
      'WebSite',
      'WebApplication',
    ]);
    expect(byType.get('WebSite')).toMatchObject({url: pageUrl(mode, '/')});
    expect(byType.get('WebApplication')).toMatchObject({
      url: `${appUrl(mode)}/`,
      operatingSystem: 'Web',
    });
    // Nothing the site does not state: no prices or ratings.
    expect(json).not.toContain('offers');
    expect(json).not.toContain('Rating');
  });

  test('robots.txt allows crawling; only production lists a sitemap', () => {
    const robots = readFileSync(file('robots.txt'), 'utf8');
    // Blocking staging would hide its noindex from crawlers.
    expect(robots).toStartWith('User-agent: *\nAllow: /\n');
    expect(robots).not.toContain('Disallow');
    if (mode === 'production') {
      expect(robots).toContain(
        'Sitemap: https://commandsnippets.com/sitemap.xml\n'
      );
    } else {
      expect(robots).not.toContain('Sitemap');
      expect(existsSync(file('sitemap.xml'))).toBe(false);
    }
  });

  if (mode === 'production') {
    test('the sitemap lists the pages with content, at their canonical URLs', () => {
      const sitemap = readFileSync(file('sitemap.xml'), 'utf8');
      const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
        match => match[1]
      );
      expect(urls).toEqual([
        'https://commandsnippets.com/',
        'https://commandsnippets.com/privacy/',
      ]);
      for (const path of CONTENT) {
        expect(canonicalOf(page(path))).toBe(pageUrl(mode, path));
      }
    });
  }
});
