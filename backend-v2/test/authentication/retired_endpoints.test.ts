import {afterEach, describe, expect, it, vi} from 'vitest';
import {requestWithEnv, setCookies} from './support';

// Native (Capacitor) sign-in left with the apps: the endpoint is gone, so a
// token posted there reaches no provider and signs nobody in.
describe('retired native sign-in', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['without an Origin', {}],
    ['from our own origin', {Origin: 'https://commandsnippets.com'}],
  ])(
    '404s %s, without calling a provider or setting cookies',
    async (_, headers) => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const response = await requestWithEnv(
        {},
        'POST',
        '/api/v1/integrated-oauth/',
        {
          data: {
            type: 'IntegratedOAuthLogin',
            attributes: {provider: 'google', token: 'token'},
          },
        },
        headers
      );
      expect(response.status).toBe(404);
      expect(setCookies(response)).toEqual({});
      expect(fetchSpy).not.toHaveBeenCalled();
    }
  );
});
