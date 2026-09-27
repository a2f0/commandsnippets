import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

type Vars = Record<string, string>;
interface WranglerConfig {
  vars: Vars;
  env: Record<string, {vars: Vars}>;
}

// wrangler.jsonc allows comments; strip line comments outside strings.
const config = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '..', 'wrangler.jsonc'), 'utf8')
    .split('\n')
    .map(line => line.replace(/^\s*\/\/.*$/, ''))
    .join('\n')
) as WranglerConfig;

const environments: Array<[string, Vars]> = [
  ['development', config.vars],
  ...Object.entries(config.env).map(
    ([name, env]) => [name, env.vars] as [string, Vars]
  ),
];

describe('wrangler.jsonc', () => {
  test.each(environments)(
    '%s: both OAuth providers redirect to the same web app origin',
    (_name, vars) => {
      const google = new URL(vars['GOOGLE_REDIRECT_URI'] ?? '');
      const github = new URL(vars['GITHUB_REDIRECT_URI'] ?? '');
      expect(google.origin).toBe(github.origin);
      expect(google.pathname).toBe('/oauth/google');
      expect(github.pathname).toBe('/oauth/github');
    }
  );

  test('the local web app runs on the frontend dev server port', () => {
    expect(new URL(config.vars['GOOGLE_REDIRECT_URI'] ?? '').origin).toBe(
      'http://localhost:8085'
    );
  });

  test("staging cookies cannot collide with production's", () => {
    // Both share the parent domain, so the cookie names must differ.
    const production = config.env['production']?.vars ?? {};
    const staging = config.env['staging']?.vars ?? {};
    expect(production['COOKIE_DOMAIN']).toBe('.commandsnippets.com');
    expect(staging['COOKIE_DOMAIN']).toBe('.commandsnippets.com');
    expect(production['COOKIE_NAME_PREFIX']).toBe('');
    expect(staging['COOKIE_NAME_PREFIX']).toBe('Staging');
  });

  // The web app lives on app / app-staging (the website has the apex); the
  // OAuth callbacks must return to the origin that started the login.
  test.each([
    ['production', 'https://app.commandsnippets.com'],
    ['staging', 'https://app-staging.commandsnippets.com'],
  ])('%s: OAuth callbacks return to %s', (name, origin) => {
    const vars = config.env[name]?.vars ?? {};
    expect(new URL(vars['GITHUB_REDIRECT_URI'] ?? '').origin).toBe(origin);
    expect(new URL(vars['GOOGLE_REDIRECT_URI'] ?? '').origin).toBe(origin);
  });
});
