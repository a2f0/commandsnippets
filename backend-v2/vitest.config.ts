import path from 'node:path';
import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers';
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
          // Mirrors scripts/runBackendTests.sh; Django tests ran with DEBUG off.
          bindings: {
            TEST_MIGRATIONS: migrations,
            DEBUG: 'false',
            COOKIE_DOMAIN: 'localhost',
            GITHUB_CLIENT_ID: 'github_client_id',
            GITHUB_CLIENT_SECRET: 'github_client_secret',
            GITHUB_REDIRECT_URI: 'https://example.com/callback',
            ELECTRON_GITHUB_CLIENT_ID: 'electron_github_client_id',
            ELECTRON_GITHUB_CLIENT_SECRET: 'electron_github_client_secret',
            ELECTRON_GITHUB_REDIRECT_URI: 'tearleads-dev://oauth/github',
            GOOGLE_CLIENT_ID: 'google_client_id',
            GOOGLE_CLIENT_SECRET: 'google_client_secret',
            GOOGLE_REDIRECT_URI: 'google_redirect_uri',
            GOOGLE_NATIVE_CLIENT_IDS:
              'native_client_id, other_native_client_id',
          },
        },
      }),
    ],
    test: {
      // scripts/ holds Bun-side tools, tested with `bun test` (bun:sqlite).
      exclude: [...configDefaults.exclude, 'scripts/**'],
      setupFiles: ['./test/setup.ts'],
      coverage: {
        provider: 'istanbul',
        include: ['src/**/*.ts'],
        reporter: ['text', 'json-summary'],
        // Parity with backend/.coveragerc (fail_under = 98).
        thresholds: {lines: 98, statements: 98},
      },
    },
  };
});
