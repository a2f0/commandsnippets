import {describe, expect, it} from 'vitest';
import {authorizationCookies} from '../../src/auth/tokens';
import {setUpBase, tokenFor, userFactory} from '../helpers';
import {
  googlePayload,
  googleRoutes,
  mockFetch,
  requestWithEnv,
  setCookies,
} from './support';

const STAGING = {
  DEBUG: 'false',
  COOKIE_DOMAIN: '.staging.commandsnippets.com',
  COOKIE_NAME_PREFIX: 'Staging',
} as const;
// No environment configures this today, so it is outside the generated union.
const HOST_ONLY = {
  DEBUG: 'false',
  COOKIE_DOMAIN: '',
} as unknown as Partial<Cloudflare.Env>;
const PRODUCTION = {
  DEBUG: 'false',
  COOKIE_DOMAIN: '.commandsnippets.com',
  COOKIE_NAME_PREFIX: '',
} as const;

const googleLogin = (overrides: Partial<Cloudflare.Env>) => {
  mockFetch(googleRoutes('someone@example.com'));
  return requestWithEnv(
    overrides,
    'POST',
    '/api/v1/google-login/',
    googlePayload()
  );
};

/** Every Set-Cookie header, including repeated names. */
const setCookieHeaders = (response: Response) =>
  response.headers.getSetCookie().map(header => {
    const [pair = '', ...attributes] = header.split(';').map(p => p.trim());
    const lower = attributes.map(a => a.toLowerCase());
    return {
      name: pair.slice(0, pair.indexOf('=')),
      value: pair.slice(pair.indexOf('=') + 1),
      domain: lower.find(a => a.startsWith('domain='))?.slice(7),
      expired: lower.includes('max-age=0'),
      secure: lower.includes('secure'),
      sameSite: lower.find(a => a.startsWith('samesite='))?.slice(9),
    };
  });

// Staging and production share a parent domain, so production's cookies are
// sent to staging hosts. Staging uses its own cookie names and scope.
describe('staging and production cookies', () => {
  it('staging sets its own cookie names, scoped to staging hosts', async () => {
    const set = setCookieHeaders(await googleLogin(STAGING)).filter(
      c => !c.expired
    );
    expect(set.map(c => c.name)).toEqual([
      'StagingAuthorization',
      'StagingLoggedIn',
    ]);
    for (const cookie of set) {
      // Visible to app.staging (which reads StagingLoggedIn), never to
      // production hosts.
      expect(cookie.domain).toBe('.staging.commandsnippets.com');
      expect(cookie.secure).toBe(true);
      expect(cookie.sameSite).toBe('strict');
    }
  });

  it('production keeps Django cookie names, domain-wide', async () => {
    const cookies = setCookies(await googleLogin(PRODUCTION));
    expect(cookies['Authorization']?.attributes['domain']).toBe(
      '.commandsnippets.com'
    );
    expect(cookies['LoggedIn']).toBeDefined();
  });

  it('an empty COOKIE_DOMAIN sets host-only cookies', async () => {
    const cookies = setCookies(await googleLogin(HOST_ONLY));
    expect(cookies['Authorization']?.attributes['domain']).toBeUndefined();
    expect(cookies['Authorization']?.attributes['secure']).toBe(true);
  });

  it('staging ignores a valid production cookie', async () => {
    const production = await userFactory();
    const staging = await userFactory();
    const productionToken = await tokenFor(production.id);
    const stagingToken = await tokenFor(staging.id);

    const both = await requestWithEnv(
      STAGING,
      'GET',
      '/api/v1/user/',
      undefined,
      {
        Cookie: `Authorization=${productionToken}; StagingAuthorization=${stagingToken}`,
      }
    );
    expect(both.status).toBe(200);
    expect((await both.json()) as object).toMatchObject({
      data: {id: String(staging.id)},
    });

    const productionOnly = await requestWithEnv(
      STAGING,
      'GET',
      '/api/v1/user/',
      undefined,
      {Cookie: `Authorization=${productionToken}`}
    );
    expect(productionOnly.status).toBe(401);
  });

  it('staging logout expires only staging cookies (and Django leftovers)', async () => {
    const set = setCookieHeaders(
      await requestWithEnv(STAGING, 'POST', '/api-token-deauth/')
    );
    for (const name of ['StagingAuthorization', 'StagingLoggedIn']) {
      expect(set).toContainEqual(
        expect.objectContaining({
          name,
          domain: '.staging.commandsnippets.com',
          expired: true,
        })
      );
    }
    // Production's domain-wide cookies are never touched...
    expect(
      set.filter(c => c.domain === '.commandsnippets.com').map(c => c.name)
    ).toEqual([]);
    // ...while Django staging's host-only cookies are cleaned up.
    for (const name of ['Authorization', 'LoggedIn']) {
      expect(set).toContainEqual(
        expect.objectContaining({name, domain: undefined, expired: true})
      );
    }
  });

  it('accepts the first valid token among duplicate cookies of its name', async () => {
    const {user1} = await setUpBase();
    const token = await tokenFor(user1.id);
    const stale = 'f'.repeat(40);
    for (const cookie of [
      `StagingAuthorization=${stale}; StagingAuthorization=${token}`,
      `StagingAuthorization=${token}; StagingAuthorization=${stale}`,
    ]) {
      const response = await requestWithEnv(
        STAGING,
        'GET',
        '/api/v1/user/',
        undefined,
        {Cookie: cookie}
      );
      expect(response.status).toBe(200);
    }
  });

  it('stays anonymous when no cookie of its name is valid', async () => {
    const {user1} = await setUpBase();
    const response = await requestWithEnv(
      PRODUCTION,
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

// Django staging (DEBUG on) left host-only cookies under Django's names on the
// API host; they are expired whenever cookies are domain-scoped.
describe('legacy host-only cookies', () => {
  it('staging login expires Django leftovers while setting its own', async () => {
    const set = setCookieHeaders(await googleLogin(STAGING));
    expect(set).toContainEqual(
      expect.objectContaining({
        name: 'Authorization',
        domain: undefined,
        expired: true,
      })
    );
    const scoped = set.find(c => c.name === 'StagingAuthorization');
    expect(scoped?.expired).toBe(false);
    expect(scoped?.value).toMatch(/^[0-9a-f]{40}$/);
  });

  it('local development (host-only cookies) sends no extra expiries', async () => {
    const set = setCookieHeaders(await googleLogin({DEBUG: 'true'}));
    expect(set.map(c => c.name)).toEqual(['Authorization', 'LoggedIn']);
    expect(set.every(c => !c.expired && c.domain === undefined)).toBe(true);
  });
});

describe('authorizationCookies', () => {
  it('returns every value of the named cookie in order', () => {
    expect(
      authorizationCookies(
        'LoggedIn=true; Authorization=a; x=1; Authorization=b'
      )
    ).toEqual(['a', 'b']);
    expect(
      authorizationCookies(
        'Authorization=a; StagingAuthorization=s',
        'StagingAuthorization'
      )
    ).toEqual(['s']);
    expect(authorizationCookies(undefined)).toEqual([]);
    expect(authorizationCookies('AuthorizationX=a')).toEqual([]);
    expect(authorizationCookies('Authorization=%E0%A4%A')).toEqual([
      '%E0%A4%A',
    ]);
  });
});
