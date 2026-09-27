import {describe, expect, it} from 'vitest';
import {userFactory} from '../helpers';
import {
  githubPayload,
  githubRoutes,
  mockFetch,
  requestWithEnv,
  setCookies,
} from './support';

const MAX_AGE = '2419200';

async function login(debug: 'true' | 'false', clientType: 'web' | 'electron') {
  await userFactory({username: 'login', email: 'user@example.com'});
  mockFetch(githubRoutes('login', 'user@example.com'));
  const response = await requestWithEnv(
    {DEBUG: debug, COOKIE_DOMAIN: '.commandsnippets.com'},
    'POST',
    '/api/v1/github-login/',
    githubPayload(clientType)
  );
  expect(response.status).toBe(200);
  return setCookies(response);
}

// v2: Django's _create_auth_response cookie matrix (DEBUG x client type).
describe('AuthCookies', () => {
  it('production web: domain-scoped, Secure, SameSite=Strict', async () => {
    const cookies = await login('false', 'web');
    expect(cookies['Authorization']?.attributes).toEqual({
      'max-age': MAX_AGE,
      domain: '.commandsnippets.com',
      path: '/',
      httponly: true,
      secure: true,
      samesite: 'Strict',
    });
    expect(cookies['LoggedIn']).toEqual({
      value: 'true',
      attributes: {
        'max-age': MAX_AGE,
        domain: '.commandsnippets.com',
        path: '/',
        secure: true,
        samesite: 'Strict',
      },
    });
  });

  it('production electron: SameSite=None and Secure', async () => {
    const cookies = await login('false', 'electron');
    for (const name of ['Authorization', 'LoggedIn']) {
      expect(cookies[name]?.attributes).toMatchObject({
        domain: '.commandsnippets.com',
        secure: true,
        samesite: 'None',
      });
    }
  });

  it('DEBUG web: host-only, not Secure, SameSite=Lax', async () => {
    const cookies = await login('true', 'web');
    for (const name of ['Authorization', 'LoggedIn']) {
      const attributes = cookies[name]?.attributes ?? {};
      expect(attributes).not.toHaveProperty('domain');
      expect(attributes).not.toHaveProperty('secure');
      expect(attributes['samesite']).toBe('Lax');
      expect(attributes['max-age']).toBe(MAX_AGE);
    }
    expect(cookies['Authorization']?.attributes['httponly']).toBe(true);
    expect(cookies['LoggedIn']?.attributes).not.toHaveProperty('httponly');
  });

  it('DEBUG electron: still Secure with SameSite=None', async () => {
    const cookies = await login('true', 'electron');
    expect(cookies['Authorization']?.attributes).toMatchObject({
      secure: true,
      samesite: 'None',
    });
    expect(cookies['Authorization']?.attributes).not.toHaveProperty('domain');
  });

  it('logout expires both cookies on the configured domain', async () => {
    const response = await requestWithEnv(
      {DEBUG: 'false', COOKIE_DOMAIN: '.commandsnippets.com'},
      'POST',
      '/api-token-deauth/',
      {}
    );
    const cookies = setCookies(response);
    for (const name of ['Authorization', 'LoggedIn']) {
      expect(cookies[name]?.value).toBe('');
      expect(cookies[name]?.attributes).toMatchObject({
        'max-age': '0',
        domain: '.commandsnippets.com',
        path: '/',
        expires: 'Thu, 01 Jan 1970 00:00:00 GMT',
      });
    }
  });

  it('logout in DEBUG expires host-only cookies', async () => {
    const response = await requestWithEnv(
      {DEBUG: 'true'},
      'POST',
      '/api-token-deauth/',
      {}
    );
    const cookies = setCookies(response);
    expect(cookies['Authorization']?.attributes).not.toHaveProperty('domain');
    expect(cookies['Authorization']?.attributes['max-age']).toBe('0');
  });
});
