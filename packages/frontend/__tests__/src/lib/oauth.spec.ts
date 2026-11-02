import {describe, expect, it} from 'vitest';
import {getOAuthRedirectUrl} from '../../../src/lib/oauth';
import {stubEnvironment} from '../../util/environment';

// The callback must return to the origin that started the login: the OAuth
// state is kept in that origin's sessionStorage.
describe('getOAuthRedirectUrl', () => {
  it.each([
    ['production', 'https://app.commandsnippets.com'],
    ['staging', 'https://app-staging.commandsnippets.com'],
    ['development', 'http://localhost:8085'],
  ])('%s returns to %s', (environment, origin) => {
    stubEnvironment(environment);
    for (const provider of ['github', 'google'] as const) {
      expect(getOAuthRedirectUrl(provider)).toBe(`${origin}/oauth/${provider}`);
    }
  });
});
