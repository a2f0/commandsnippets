import {describe, expect, test} from 'bun:test';
import {join} from 'node:path';
import {appUrl} from '../src/lib/appUrl';
import worker from '../worker/index';
import {readWrangler} from './support/wrangler';

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

  test('production responses carry no robots header', () => {
    expect(request('/dan').headers.has('X-Robots-Tag')).toBe(false);
    expect(request('/dan', 'POST').headers.has('X-Robots-Tag')).toBe(false);
  });

  test('X_ROBOTS_TAG is sent on every response', () => {
    const staging = {...env, X_ROBOTS_TAG: 'noindex, nofollow'};
    for (const method of ['GET', 'POST']) {
      const response = worker.fetch(
        new Request('https://commandsnippets.com/dan', {method}),
        staging
      );
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    }
  });
});

describe('wrangler.jsonc', () => {
  const config = readWrangler(join(import.meta.dir, '..', 'wrangler.jsonc'));

  test('each environment redirects to the app its pages link to', () => {
    expect(config.vars.APP_ORIGIN).toBe(appUrl('development'));
    for (const mode of ['staging', 'production']) {
      expect(config.env[mode]?.vars.APP_ORIGIN).toBe(appUrl(mode));
    }
  });

  // Wrangler does not inherit vars into environments, so only staging has it.
  test('only staging sends noindex from the Worker', () => {
    const {staging, production} = config.env;
    expect(staging?.vars.X_ROBOTS_TAG).toBe('noindex, nofollow');
    expect(production?.vars).toEqual({
      APP_ORIGIN: 'https://app.commandsnippets.com',
    });
  });

  test.each([
    ['staging', 'website-staging.commandsnippets.com'],
    ['production', 'commandsnippets.com'],
  ])('%s is served only on %s', (mode, host) => {
    expect(config.env[mode]?.routes).toEqual([
      {pattern: host, custom_domain: true},
    ]);
    expect(config.env[mode]?.workers_dev).toBe(false);
  });

  test('serves the built pages and falls through to the Worker', () => {
    expect(config.assets).toEqual({
      directory: './dist',
      not_found_handling: 'none',
    });
    expect(config.compatibility_flags).toContain(
      'assets_navigation_has_no_effect'
    );
  });
});
