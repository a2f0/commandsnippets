import {applyD1Migrations, reset} from 'cloudflare:test';
import {env} from 'cloudflare:workers';
import {afterEach, beforeEach, vi} from 'vitest';

// Each test starts from an empty, fully migrated database (Django's
// TestCase isolation).
beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

afterEach(() => {
  vi.restoreAllMocks();
});
