import {eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {users} from '../../src/db/schema';
import {
  ApiClient,
  db,
  json,
  setUpBase,
  tokenFor,
  userByUsername,
  userFactory,
} from '../helpers';
import {
  GOOGLE_TOKENINFO_URL,
  GOOGLE_USERINFO_URL,
  mockFetch,
  requestWithEnv,
  setCookies,
  tokenInfoRoute,
} from './support';

const payload = (attributes: Record<string, unknown>) => ({
  data: {type: 'IntegratedOAuthLogin', attributes},
});

// tearleads/authentication/tests/test_integrated_oauth.py
describe('TestIntegratedOAuth', () => {
  beforeEach(async () => {
    await setUpBase();
  });

  it('test_successful_integrated_google_login_for_new_user', async () => {
    const calls = mockFetch([
      tokenInfoRoute(),
      {
        method: 'GET',
        url: GOOGLE_USERINFO_URL,
        body: {email: 'google_user@example.com', email_verified: true},
      },
    ]);
    const client = new ApiClient();

    expect(await userByUsername('google_user')).toBeUndefined();

    const response = await client.post(
      '/api/v1/integrated-oauth/',
      payload({provider: 'google', token: 'valid_google_token'})
    );

    const user = await userByUsername('google_user');
    expect(user?.last_login).not.toBeNull();
    expect(user?.last_login).toBe(user?.date_joined);
    expect(user?.login_count).toBe(1);
    const existingToken = await tokenFor(user?.id as number);
    expect(response.status).toBe(200);
    expect(client.cookies.has('Authorization')).toBe(true);
    expect(client.cookies.get('Authorization')?.value).toBe(existingToken);
    // No code exchange: the client's token is checked with tokeninfo (in a
    // header, never the URL), then goes to userinfo.
    expect(calls.map(call => `${call.method} ${call.url}`)).toEqual([
      `POST ${GOOGLE_TOKENINFO_URL}`,
      `GET ${GOOGLE_USERINFO_URL}`,
    ]);
    for (const call of calls) {
      expect(call.headers.get('Authorization')).toBe(
        'Bearer valid_google_token'
      );
    }
  });

  it('test_successful_integrated_google_login_for_existing_user', async () => {
    const existingUser = await userFactory({
      username: 'google_user',
      email: 'google_user@example.com',
    });
    // Set an old login time to ensure it gets updated.
    const oldLoginTime = '2020-01-01T00:00:00.000000';
    await db()
      .update(users)
      .set({last_login: oldLoginTime})
      .where(eq(users.id, existingUser.id));
    expect(existingUser.login_count).toBe(1);

    mockFetch([
      tokenInfoRoute(),
      {
        method: 'GET',
        url: GOOGLE_USERINFO_URL,
        body: {email: 'google_user@example.com', email_verified: true},
      },
    ]);
    const client = new ApiClient();

    const userBefore = await userByUsername('google_user');
    expect(userBefore?.id).toBe(existingUser.id);

    const response = await client.post(
      '/api/v1/integrated-oauth/',
      payload({provider: 'google', token: 'valid_google_token'})
    );

    const userAfter = await userByUsername('google_user');
    expect(userAfter?.id).toBe(existingUser.id);
    expect(userAfter?.last_login).not.toBe(oldLoginTime);
    expect(userAfter?.login_count).toBe(2);

    const existingToken = await tokenFor(existingUser.id);
    expect(response.status).toBe(200);
    expect(client.cookies.has('Authorization')).toBe(true);
    expect(client.cookies.get('Authorization')?.value).toBe(existingToken);
  });

  it('test_integrated_oauth_unsupported_provider', async () => {
    const response = await new ApiClient().post(
      '/api/v1/integrated-oauth/',
      payload({provider: 'github', token: 'valid_token'})
    );
    expect(response.status).toBe(400);
    expect((await json(response)).errors[0].detail).toBe(
      '"github" is not a valid choice.'
    );
  });

  it('test_integrated_oauth_invalid_serializer_data', async () => {
    const response = await new ApiClient().post(
      '/api/v1/integrated-oauth/',
      payload({token: 'valid_token'})
    );
    expect(response.status).toBe(400);
  });

  it('test_integrated_oauth_google_invalid_token_response', async () => {
    mockFetch([
      tokenInfoRoute(),
      {
        method: 'GET',
        url: GOOGLE_USERINFO_URL,
        status: 401,
        body: {error: 'invalid_token'},
      },
    ]);
    const response = await new ApiClient().post(
      '/api/v1/integrated-oauth/',
      payload({provider: 'google', token: 'invalid_token'})
    );
    expect(response.status).toBe(403);
    // JSON:API error format.
    const {errors} = await json(response);
    expect(Array.isArray(errors)).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toHaveProperty('detail');
    expect(errors[0].detail).toBe('Invalid access token provided');
  });

  it('test_google_direct_access_token_flow', async () => {
    mockFetch([
      tokenInfoRoute(),
      {
        method: 'GET',
        url: GOOGLE_USERINFO_URL,
        body: {email: 'native_user@example.com', email_verified: true},
      },
    ]);
    const client = new ApiClient();

    expect(await userByUsername('native_user')).toBeUndefined();

    const response = await client.post(
      '/api/v1/integrated-oauth/',
      payload({provider: 'google', token: 'direct_access_token'})
    );

    const user = await userByUsername('native_user');
    expect(response.status).toBe(200);
    expect(user?.login_count).toBe(1);
  });

  it('test_integrated_oauth_google_missing_email', async () => {
    mockFetch([
      tokenInfoRoute(),
      {
        method: 'GET',
        url: GOOGLE_USERINFO_URL,
        body: {id: '12345', name: 'Test User'},
      },
    ]);
    const response = await new ApiClient().post(
      '/api/v1/integrated-oauth/',
      payload({provider: 'google', token: 'valid_token'})
    );
    expect(response.status).toBe(403);
    const {errors} = await json(response);
    expect(Array.isArray(errors)).toBe(true);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toHaveProperty('detail');
  });
});

// Userinfo answers for a Google token issued to any app, so the token's
// audience must be one of our native apps: otherwise any app a user signed in
// to with Google could replay their token here.
describe('native Google token audience', () => {
  const login = (token = 'token') =>
    new ApiClient().post(
      '/api/v1/integrated-oauth/',
      payload({provider: 'google', token})
    );
  const userinfo = {
    method: 'GET' as const,
    url: GOOGLE_USERINFO_URL,
    body: {email: 'victim@example.com', email_verified: true},
  };

  it("rejects a token issued to another app, without reading the user's email", async () => {
    const victim = await userFactory({email: 'victim@example.com'});
    for (const route of [
      tokenInfoRoute('someone_elses_client_id'),
      // A prefix, a superset or the whole setting is not a match either.
      tokenInfoRoute('native_client'),
      tokenInfoRoute('native_client_id, other_native_client_id'),
      {...tokenInfoRoute(), body: {azp: 'native_client_id'}},
      {...tokenInfoRoute(), body: {aud: ['native_client_id']}},
    ]) {
      const calls = mockFetch([route, userinfo]);
      const response = await login();
      expect(response.status).toBe(403);
      expect((await json(response)).errors[0].detail).toBe(
        'Invalid access token provided'
      );
      expect(setCookies(response)).toEqual({});
      expect(calls.map(call => call.url)).toEqual([GOOGLE_TOKENINFO_URL]);
    }
    const [row] = await db()
      .select()
      .from(users)
      .where(eq(users.id, victim.id));
    expect(row?.login_count).toBe(1);
  });

  it('rejects a token tokeninfo does not recognize', async () => {
    for (const route of [
      {...tokenInfoRoute(), status: 400, body: {error: 'invalid_token'}},
      {...tokenInfoRoute(), body: 'not json', contentType: 'text/plain'},
    ]) {
      mockFetch([route, userinfo]);
      expect((await login()).status).toBe(403);
    }
  });

  it('accepts any configured native app', async () => {
    mockFetch([tokenInfoRoute('other_native_client_id'), userinfo]);
    const response = await login();
    expect(response.status).toBe(200);
  });

  it('refuses native logins when no native app is configured', async () => {
    mockFetch([tokenInfoRoute(), userinfo]);
    const response = await requestWithEnv(
      {GOOGLE_NATIVE_CLIENT_IDS: ' , '} as unknown as Partial<Cloudflare.Env>,
      'POST',
      '/api/v1/integrated-oauth/',
      payload({provider: 'google', token: 'token'})
    );
    expect(response.status).toBe(403);
  });
});
