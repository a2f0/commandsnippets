import {beforeEach, describe, expect, it} from 'vitest';
import {
  ApiClient,
  json,
  setUpBase,
  tokenFor,
  userByUsername,
  userFactory,
} from '../helpers';
import {GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL, mockFetch} from './support';

const COOKIE_DOMAIN = 'localhost';
const MAX_AGE = '2419200';

const payload = {
  data: {type: 'GoogleLogin', attributes: {code: 'valid_code'}},
};

function googleRoutes(userinfo: object) {
  return mockFetch([
    {
      method: 'POST',
      url: GOOGLE_TOKEN_URL,
      body: {
        access_token: 'test_access_token',
        token_type: 'Bearer',
        expires_in: 3600,
      },
    },
    {method: 'GET', url: GOOGLE_USERINFO_URL, body: userinfo},
  ]);
}

function expectAuthCookies(client: ApiClient, token: string) {
  expect(client.cookies.has('Authorization')).toBe(true);
  expect(client.cookies.get('Authorization')?.value).toBe(token);
  expect(client.cookies.get('Authorization')?.attributes['domain']).toBe(
    COOKIE_DOMAIN
  );
  expect(client.cookies.get('Authorization')?.attributes['max-age']).toBe(
    MAX_AGE
  );
  expect(client.cookies.has('LoggedIn')).toBe(true);
  expect(client.cookies.get('LoggedIn')?.attributes['max-age']).toBe(MAX_AGE);
  expect(client.cookies.get('LoggedIn')?.attributes['domain']).toBe(
    COOKIE_DOMAIN
  );
  expect(client.cookies.get('Authorization')?.value).not.toBe('');
}

// tearleads/authentication/tests/test_google_authentication.py
describe('TestGoogleAuthentication', () => {
  beforeEach(async () => {
    await setUpBase();
  });

  it('test_successful_google_login_for_new_user', async () => {
    const calls = googleRoutes({
      email: 'user@example.com',
      email_verified: true,
    });
    const client = new ApiClient();

    expect(await userByUsername('user')).toBeUndefined();

    const response = await client.post('/api/v1/google-login/', payload);

    const user = await userByUsername('user');
    expect(user?.last_login).not.toBeNull();
    expect(user?.last_login).toBe(user?.date_joined);
    expect(user?.login_count).toBe(1);
    const existingToken = await tokenFor(user?.id as number);
    expect(response.status).toBe(200);
    expectAuthCookies(client, existingToken);
    // The userinfo call uses the access token from the code exchange.
    expect(calls[1]?.headers.get('Authorization')).toBe(
      'Bearer test_access_token'
    );
  });

  it('test_successful_google_login_for_existing_user', async () => {
    const existingUser = await userFactory({
      username: 'user',
      email: 'user@example.com',
    });
    const oldLoginTime = existingUser.last_login;
    expect(existingUser.login_count).toBe(1);

    googleRoutes({email: 'user@example.com', email_verified: true});
    const client = new ApiClient();

    const userBefore = await userByUsername('user');
    expect(userBefore?.id).toBe(existingUser.id);

    const response = await client.post('/api/v1/google-login/', payload);

    const userAfter = await userByUsername('user');
    expect(userAfter?.id).toBe(existingUser.id);
    expect(userAfter?.last_login).not.toBe(oldLoginTime);
    expect(userAfter?.login_count).toBe(2);

    const existingToken = await tokenFor(existingUser.id);
    expect(response.status).toBe(200);
    expectAuthCookies(client, existingToken);
  });
});

// v2: Google web login failure paths.
describe('GoogleLoginFailures', () => {
  it('returns 400 when Google returns no email', async () => {
    googleRoutes({id: '12345'});
    const response = await new ApiClient().post(
      '/api/v1/google-login/',
      payload
    );
    expect(response.status).toBe(400);
    expect((await json(response)).errors[0].detail).toBe(
      'No email found in Google user data'
    );
  });

  it('returns 401 when the code exchange fails', async () => {
    mockFetch([
      {
        method: 'POST',
        url: GOOGLE_TOKEN_URL,
        status: 400,
        body: {error: 'invalid_grant'},
      },
    ]);
    const response = await new ApiClient().post(
      '/api/v1/google-login/',
      payload
    );
    expect(response.status).toBe(401);
    expect(await json(response)).toEqual({errors: []});
  });

  it('returns 401 when userinfo fails', async () => {
    mockFetch([
      {method: 'POST', url: GOOGLE_TOKEN_URL, body: {access_token: 'token'}},
      {method: 'GET', url: GOOGLE_USERINFO_URL, status: 401, body: {}},
    ]);
    const response = await new ApiClient().post(
      '/api/v1/google-login/',
      payload
    );
    expect(response.status).toBe(401);
  });

  it('requires a code', async () => {
    const response = await new ApiClient().post('/api/v1/google-login/', {
      data: {type: 'GoogleLogin', attributes: {}},
    });
    expect(response.status).toBe(400);
    expect((await json(response)).errors[0].detail).toBe(
      'This field is required.'
    );
  });
});
