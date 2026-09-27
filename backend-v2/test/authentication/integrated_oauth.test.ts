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
import {GOOGLE_USERINFO_URL, mockFetch} from './support';

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
    // No code exchange: the client's token goes straight to userinfo.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers.get('Authorization')).toBe(
      'Bearer valid_google_token'
    );
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
