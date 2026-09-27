import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {afterEach, describe, expect, it, vi} from 'vitest';

import * as envModule from '../../src/lib/environment';
import {getOAuthRedirectUrl} from '../../src/lib/oauth';

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

// wrangler.jsonc allows comments; strip line comments outside strings.
const config = JSON.parse(
  read('../../wrangler.jsonc')
    .split('\n')
    .map(line => line.replace(/^\s*\/\/.*$/, ''))
    .join('\n')
) as {
  assets: {directory: string; not_found_handling: string};
  env: Record<
    string,
    {
      workers_dev: boolean;
      routes: Array<{pattern: string; custom_domain: boolean}>;
    }
  >;
};

describe('wrangler.jsonc', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serves the Vite build as a single-page app', () => {
    expect(read('../../vite.config.ts')).toContain("outDir: 'build'");
    expect(config.assets).toEqual({
      directory: './build',
      not_found_handling: 'single-page-application',
    });
  });

  // OAuth returns to the app's own origin, so the app must be served there.
  it('serves staging on the host its OAuth callbacks return to', () => {
    vi.spyOn(envModule, 'environment', 'get').mockReturnValue('staging');
    const host = new URL(getOAuthRedirectUrl('github')).host;
    expect(config.env['staging']?.routes).toEqual([
      {pattern: host, custom_domain: true},
    ]);
  });

  it('attaches production only at cutover, and never workers.dev', () => {
    expect(config.env['production']?.routes).toEqual([]);
    for (const env of ['staging', 'production']) {
      expect(config.env[env]?.workers_dev).toBe(false);
    }
  });
});
