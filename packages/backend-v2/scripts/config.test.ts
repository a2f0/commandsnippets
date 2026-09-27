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
    const production = config.env['production']?.vars['COOKIE_DOMAIN'];
    const staging = config.env['staging']?.vars['COOKIE_DOMAIN'];
    expect(production).toBe('.commandsnippets.com');
    expect(staging).toBe('.staging.commandsnippets.com');
    expect(staging).not.toBe(production);
  });
});
