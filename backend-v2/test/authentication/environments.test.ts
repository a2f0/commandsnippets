import {describe, expect, it} from 'vitest';
import {authorizationCookies} from '../../src/auth/tokens';
import {setUpBase, tokenFor} from '../helpers';
import {
  GOOGLE_USERINFO_URL,
  mockFetch,
  requestWithEnv,
  setCookies,
} from './support';

const STAGING = {DEBUG: 'false', COOKIE_DOMAIN: ''} as const;
const PRODUCTION = {
  DEBUG: 'false',
  COOKIE_DOMAIN: '.commandsnippets.com',
} as const;

const integratedLogin = (overrides: Partial<Cloudflare.Env>) => {
  mockFetch([
    {
      method: 'GET',
      url: GOOGLE_USERINFO_URL,
      body: {email: 'someone@example.com', email_verified: true},
    },
  ]);
  return requestWithEnv(overrides, 'POST', '/api/v1/integrated-oauth/', {
    data: {
      type: 'IntegratedOAuthLogin',
      attributes: {provider: 'google', token: 'token'},
    },
  });
};

// Staging and production share cookie names and a parent domain. Staging
// cookies must never overwrite or clear production's, and the staging API
// must cope with receiving both.
describe('staging and production cookies', () => {
  it('staging sets host-only cookies that are still Secure and Strict', async () => {
    const cookies = setCookies(await integratedLogin(STAGING));
    for (const name of ['Authorization', 'LoggedIn']) {
      const attributes = cookies[name]?.attributes ?? {};
      expect(attributes['domain']).toBeUndefined();
      expect(attributes['secure']).toBe(true);
      expect(attributes['samesite']).toBe('Strict');
    }
  });

  it('production sets domain-wide cookies', async () => {
    const cookies = setCookies(await integratedLogin(PRODUCTION));
    expect(cookies['Authorization']?.attributes['domain']).toBe(
      '.commandsnippets.com'
    );
  });

  it('staging logout only expires its own host-only cookies', async () => {
    const cookies = setCookies(
      await requestWithEnv(STAGING, 'POST', '/api-token-deauth/')
    );
    for (const name of ['Authorization', 'LoggedIn']) {
      expect(cookies[name]?.attributes['max-age']).toBe('0');
      expect(cookies[name]?.attributes['domain']).toBeUndefined();
    }
  });

  it('accepts the valid token when both environments send a cookie', async () => {
    const {user1} = await setUpBase();
    const token = await tokenFor(user1.id);
    const foreign = 'f'.repeat(40);
    for (const cookie of [
      `Authorization=${foreign}; Authorization=${token}`,
      `Authorization=${token}; Authorization=${foreign}`,
    ]) {
      const response = await requestWithEnv(
        STAGING,
        'GET',
        '/api/v1/user/',
        undefined,
        {Cookie: cookie}
      );
      expect(response.status).toBe(200);
      expect((await response.json()) as object).toMatchObject({
        data: {id: String(user1.id)},
      });
    }
  });

  it('stays anonymous when no Authorization cookie is valid', async () => {
    const {user1} = await setUpBase();
    const response = await requestWithEnv(
      STAGING,
      'GET',
      '/api/v1/user/',
      undefined,
      {
        Cookie: `Authorization=${'a'.repeat(40)}; Authorization=${'b'.repeat(40)}`,
        // Cookies take precedence: a valid header is not a fallback.
        Authorization: `Token ${await tokenFor(user1.id)}`,
      }
    );
    expect(response.status).toBe(401);
  });
});

describe('authorizationCookies', () => {
  it('returns every Authorization value in order', () => {
    expect(
      authorizationCookies(
        'LoggedIn=true; Authorization=a; x=1; Authorization=b'
      )
    ).toEqual(['a', 'b']);
    expect(authorizationCookies(undefined)).toEqual([]);
    expect(authorizationCookies('AuthorizationX=a')).toEqual([]);
    expect(authorizationCookies('Authorization=%E0%A4%A')).toEqual([
      '%E0%A4%A',
    ]);
  });
});
