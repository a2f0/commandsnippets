import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {appUrl} from '../src/lib/appUrl';
import worker from '../worker/index';

const env = {APP_ORIGIN: 'https://app.commandsnippets.com'};
const request = (path: string, method = 'GET') =>
  worker.fetch(
    new Request(`https://commandsnippets.com${path}`, {method}),
    env
  );

// The app used to be served here, so its links must keep working.
describe('old app links', () => {
  test.each([
    '/dan',
    '/dan/kubernetes',
    '/dan/kubernetes?search=pods',
    '/oauth/github?code=abc&state=xyz',
  ])('%s redirects to the same path and query on the app', path => {
    const response = request(path);
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(
      `https://app.commandsnippets.com${path}`
    );
  });

  test('HEAD redirects too; other methods are refused', () => {
    expect(request('/dan', 'HEAD').status).toBe(302);
    const post = request('/dan', 'POST');
    expect(post.status).toBe(405);
    expect(post.headers.get('Allow')).toBe('GET, HEAD');
  });
});

describe('wrangler.jsonc', () => {
  const config = JSON.parse(
    readFileSync(join(import.meta.dir, '..', 'wrangler.jsonc'), 'utf8')
      .split('\n')
      .map(line => line.replace(/^\s*\/\/.*$/, ''))
      .join('\n')
  ) as {
    vars: {APP_ORIGIN: string};
    env: Record<string, {vars: {APP_ORIGIN: string}}>;
    assets: {directory: string; not_found_handling: string};
    compatibility_flags: string[];
  };

  test('each environment redirects to the app its pages link to', () => {
    expect(config.vars.APP_ORIGIN).toBe(appUrl('development'));
    for (const mode of ['staging', 'production']) {
      expect(config.env[mode]?.vars.APP_ORIGIN).toBe(appUrl(mode));
    }
  });

  test('serves the built pages and falls through to the Worker', () => {
    expect(config.assets.directory).toBe('./dist');
    expect(config.assets.not_found_handling).toBe('none');
    expect(config.compatibility_flags).toContain(
      'assets_navigation_has_no_effect'
    );
  });
});
