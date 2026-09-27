import {afterAll, beforeAll, describe, expect, test} from 'bun:test';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {appUrl, FOOTER_LINKS} from '../src/lib/appUrl';

const root = join(import.meta.dir, '..');

describe('appUrl', () => {
  test('points each build mode at its app', () => {
    expect(appUrl('production')).toBe('https://app.commandsnippets.com');
    expect(appUrl('staging')).toBe('https://app-staging.commandsnippets.com');
    expect(appUrl('development')).toBe('http://localhost:8085');
  });
});

// Build the real site per mode and check the HTML it produces.
describe.each(['staging', 'production'] as const)('the %s build', mode => {
  let outDir = '';
  const page = (path: string) =>
    readFileSync(join(outDir, path, 'index.html'), 'utf8');

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
    expect(html).toContain(`id="loginLink" href="${appUrl(mode)}"`);
    expect(html).toContain(`href="${appUrl(mode)}">Get started</a>`);
  });

  test('every footer link has a page', () => {
    for (const link of FOOTER_LINKS) {
      const html = page(link.href);
      expect(html).toContain(`<h1>${link.text}</h1>`);
      expect(html).toContain('This page is coming soon.');
      expect(page('')).toContain(`href="${link.href}"`);
    }
  });

  test('ships the favicon and no old branding', () => {
    expect(existsSync(join(outDir, 'favicon.svg'))).toBe(true);
    for (const path of ['', ...FOOTER_LINKS.map(link => link.href)]) {
      expect(page(path).toLowerCase()).not.toContain('tearleads');
    }
  });
});
