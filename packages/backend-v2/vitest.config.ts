import path from 'node:path';
import {cloudflareTest, readD1Migrations} from '@cloudflare/vitest-plugin';
import {configDefaults, defineConfig} from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(import.meta.dirname, 'migrations')
  );
  return {
    plugins: [
      cloudflareTest({
        wrangler: {configPath: './wrangler.jsonc'},
        miniflare: {
          // Production cookie behavior (DEBUG off: Secure, SameSite=Strict,
          // domain-scoped) on a local domain, and placeholder OAuth settings
          // for the mocked providers.
          bindings: {
            TEST_MIGRATIONS: migrations,
            DEBUG: 'false',
            COOKIE_DOMAIN: 'localhost',
            GITHUB_CLIENT_ID: 'github_client_id',
            GITHUB_CLIENT_SECRET: 'github_client_secret',
            GITHUB_REDIRECT_URI: 'https://example.com/callback',
            GOOGLE_CLIENT_ID: 'google_client_id',
            GOOGLE_CLIENT_SECRET: 'google_client_secret',
            GOOGLE_REDIRECT_URI: 'google_redirect_uri',
          },
        },
      }),
    ],
    test: {
      // scripts/ holds Bun-side tools, tested with `bun test` (bun:sqlite).
      exclude: [...configDefaults.exclude, 'scripts/**'],
      setupFiles: ['./test/setup.ts'],
      coverage: {
        provider: 'istanbul' as const,
        include: ['src/**/*.ts'],
        reporter: ['text', 'json-summary'],
        // The src/ gate (README, Development); scripts/ has its own in
        // bunfig.toml.
        thresholds: {lines: 98, statements: 98},
      },
    },
  };
});
