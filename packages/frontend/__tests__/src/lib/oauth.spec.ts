import {afterEach, describe, expect, it, vi} from 'vitest';

import * as envModule from '../../../src/lib/environment';
import {getOAuthRedirectUrl} from '../../../src/lib/oauth';

// The callback must return to the origin that started the login: the OAuth
// state is kept in that origin's sessionStorage.
describe('getOAuthRedirectUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['production', 'https://app.commandsnippets.com'],
    ['staging', 'https://app-staging.commandsnippets.com'],
    ['development', 'http://localhost:8085'],
  ])('%s returns to %s', (environment, origin) => {
    vi.spyOn(envModule, 'environment', 'get').mockReturnValue(environment);
    for (const provider of ['github', 'google'] as const) {
      expect(getOAuthRedirectUrl(provider)).toBe(`${origin}/oauth/${provider}`);
    }
  });
});
