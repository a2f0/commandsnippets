import {describe, expect, it} from 'vitest';
import {authorizationCookies} from '../../src/auth/tokens';
import {setUpBase, tokenFor} from '../helpers';
import {
  GOOGLE_USERINFO_URL,
  mockFetch,
  requestWithEnv,
  setCookies,
} from './support';

const STAGING = {
  DEBUG: 'false',
  COOKIE_DOMAIN: '.staging.commandsnippets.com',
} as const;
// No environment configures this today, so it is outside the generated union.
const HOST_ONLY = {
  DEBUG: 'false',
  COOKIE_DOMAIN: '',
} as unknown as Partial<Cloudflare.Env>;
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
  it('staging scopes cookies to staging hosts, Secure and Strict', async () => {
    const cookies = setCookies(await integratedLogin(STAGING));
    for (const name of ['Authorization', 'LoggedIn']) {
      const attributes = cookies[name]?.attributes ?? {};
      // Visible to app.staging (which reads LoggedIn), never to production.
      expect(attributes['domain']).toBe('.staging.commandsnippets.com');
      expect(attributes['secure']).toBe(true);
      expect(attributes['samesite']).toBe('Strict');
    }
  });

  it('an empty COOKIE_DOMAIN sets host-only cookies', async () => {
    const cookies = setCookies(await integratedLogin(HOST_ONLY));
    expect(cookies['Authorization']?.attributes['domain']).toBeUndefined();
    expect(cookies['Authorization']?.attributes['secure']).toBe(true);
  });

  it('production sets domain-wide cookies', async () => {
    const cookies = setCookies(await integratedLogin(PRODUCTION));
    expect(cookies['Authorization']?.attributes['domain']).toBe(
      '.commandsnippets.com'
    );
  });

  it('staging logout only expires its own staging-scoped cookies', async () => {
    const cookies = setCookies(
      await requestWithEnv(STAGING, 'POST', '/api-token-deauth/')
    );
    for (const name of ['Authorization', 'LoggedIn']) {
      expect(cookies[name]?.attributes['max-age']).toBe('0');
      expect(cookies[name]?.attributes['domain']).toBe(
        '.staging.commandsnippets.com'
      );
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

// Django staging (DEBUG on) left host-only cookies on the API host. Browsers
// keep them apart from the domain-scoped ones, so both must be handled.
describe('legacy host-only cookies', () => {
  const headers = (response: Response) =>
    response.headers.getSetCookie().map(header => {
      const [pair = '', ...attributes] = header.split(';').map(p => p.trim());
      const lower = attributes.map(a => a.toLowerCase());
      return {
        name: pair.slice(0, pair.indexOf('=')),
        value: pair.slice(pair.indexOf('=') + 1),
        domain: lower.find(a => a.startsWith('domain='))?.slice(7),
        expired: lower.includes('max-age=0'),
      };
    });

  it('staging logout expires both the scoped and the host-only cookies', async () => {
    const set = headers(
      await requestWithEnv(STAGING, 'POST', '/api-token-deauth/')
    );
    for (const name of ['Authorization', 'LoggedIn']) {
      const forName = set.filter(c => c.name === name);
      expect(forName).toContainEqual(
        expect.objectContaining({
          domain: '.staging.commandsnippets.com',
          expired: true,
        })
      );
      expect(forName).toContainEqual(
        expect.objectContaining({domain: undefined, expired: true})
      );
    }
  });

  it('staging login expires host-only leftovers while setting scoped cookies', async () => {
    const set = headers(await integratedLogin(STAGING));
    const auth = set.filter(c => c.name === 'Authorization');
    expect(auth).toContainEqual(
      expect.objectContaining({domain: undefined, expired: true})
    );
    const scoped = auth.find(c => c.domain === '.staging.commandsnippets.com');
    expect(scoped?.expired).toBe(false);
    expect(scoped?.value).toMatch(/^[0-9a-f]{40}$/);
  });

  it('local development (host-only cookies) sends no extra expiries', async () => {
    const set = headers(await integratedLogin({DEBUG: 'true'}));
    expect(set.map(c => c.name)).toEqual(['Authorization', 'LoggedIn']);
    expect(set.every(c => !c.expired && c.domain === undefined)).toBe(true);
  });
});
