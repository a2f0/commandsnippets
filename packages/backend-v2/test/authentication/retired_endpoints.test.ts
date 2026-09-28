import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ApiClient, type Base, setUpBase, userFactory} from '../helpers';
import {requestWithEnv, setCookies} from './support';

// Native (Capacitor) sign-in left with the apps: the endpoint is gone, so a
// token posted there reaches no provider and signs nobody in.
describe('retired native sign-in', () => {
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

// Password login (`/api-token-auth/`) is gone: the frontend never used it, and
// Workers' WebCrypto caps PBKDF2 below Django's iterations.
// Django origin: backend/tearleads/authentication/tests/test_authentication.py
describe('TestAuthentication', () => {
  let base: Base;

  beforeEach(async () => {
    base = await setUpBase();
  });

  it('test_failed_authentication', async () => {
    // v2 deviation: the password endpoint no longer exists.
    const response = await base.user1Client.post('/api-token-auth/', {
      username: 'user1',
      password: 'wrongpassword',
    });
    expect(response.status).toBe(404);
  });

  it('test_blank_passwords_not_allowed', async () => {
    // v2 deviation: users have no password column and the password endpoint
    // is gone, so every variant is a 404 rather than a 400.
    const user = await userFactory({
      username: 'user',
      email: 'user@example.com',
    });
    expect(user.id).not.toBeNull();
    expect('password' in user).toBe(false);
    const client = new ApiClient();
    for (const payload of [
      {username: 'user', password: ''},
      {username: 'user'},
      {username: 'user', password: null},
    ]) {
      const response = await client.post('/api-token-auth/', payload);
      expect(response.status).toBe(404);
    }
  });
});
