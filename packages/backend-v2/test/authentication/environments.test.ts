import {describe, expect, it} from 'vitest';
import {authorizationCookies} from '../../src/auth/cookies';
import {
  setCookieHeaders as parsedSetCookies,
  setUpBase,
  tokenFor,
  userFactory,
} from '../helpers';
import {
  googlePayload,
  googleRoutes,
  mockFetch,
  requestWithEnv,
  setCookies,
} from '../support/auth';

const STAGING = {
  DEBUG: 'false',
  COOKIE_DOMAIN: '.commandsnippets.com',
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

const lowerCase = (value: string | true | undefined) =>
  typeof value === 'string' ? value.toLowerCase() : undefined;

/** Every Set-Cookie header, including repeated names, summarized. */
const setCookieHeaders = (response: Response) =>
  parsedSetCookies(response).map(({name, value, attributes}) => ({
    name,
    value,
    domain: lowerCase(attributes['domain']),
    expired: attributes['max-age'] === '0',
    secure: attributes['secure'] === true,
    sameSite: lowerCase(attributes['samesite']),
  }));

// Staging and production share a parent domain, so production's cookies are
// sent to staging hosts. Staging uses its own cookie names and scope.
describe('staging and production cookies', () => {
  it('staging sets its own cookie names on the shared domain', async () => {
    const set = setCookieHeaders(await googleLogin(STAGING));
    expect(set.map(c => c.name)).toEqual([
      'StagingAuthorization',
      'StagingLoggedIn',
    ]);
    for (const cookie of set) {
      expect(cookie.expired).toBe(false);
      // Visible to app-staging (which reads StagingLoggedIn); production
      // ignores these names.
      expect(cookie.domain).toBe('.commandsnippets.com');
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

  it('staging logout expires only staging cookies', async () => {
    const set = setCookieHeaders(
      await requestWithEnv(STAGING, 'POST', '/api-token-deauth/')
    );
    for (const name of ['StagingAuthorization', 'StagingLoggedIn']) {
      expect(set).toContainEqual(
        expect.objectContaining({
          name,
          domain: '.commandsnippets.com',
          expired: true,
        })
      );
    }
    // Production's cookies (same domain, other names) are never touched.
    expect(set.map(c => c.name).sort()).toEqual([
      'StagingAuthorization',
      'StagingLoggedIn',
    ]);
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
