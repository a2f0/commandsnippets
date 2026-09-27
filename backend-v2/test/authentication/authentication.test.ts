import {eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {tokens} from '../../src/db/schema';
import {
  ApiClient,
  type Base,
  db,
  json,
  refreshUser,
  setUpBase,
  tokenFor,
  userFactory,
} from '../helpers';
import {GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL, mockFetch} from './support';

const COOKIE_DOMAIN = 'localhost';
const MAX_AGE = '2419200';

async function assertLogoutResponseIsOk(response: Response) {
  expect(response.status).toBe(200);
  expect(await json(response)).toEqual({});
}

// tearleads/authentication/tests/test_authentication.py
describe('TestAuthentication', () => {
  let base: Base;

  beforeEach(async () => {
    base = await setUpBase();
  });

  it('test_successful_authentication_then_deauthentication', async () => {
    // v2 drops the /api-token-auth/ password login (Workers caps PBKDF2 at
    // 100k iterations, below Django's hashes), so log in through a mocked
    // OAuth flow instead; the cookie/deauth assertions are unchanged.
    const authUser = await userFactory();
    const existingToken = await tokenFor(authUser.id);
    const client = new ApiClient();
    mockFetch([
      {method: 'POST', url: GOOGLE_TOKEN_URL, body: {access_token: 'token'}},
      {
        method: 'GET',
        url: GOOGLE_USERINFO_URL,
        body: {email: authUser.email, email_verified: true},
      },
    ]);

    const response = await client.post('/api/v1/google-login/', {
      data: {type: 'GoogleLogin', attributes: {code: 'valid_code'}},
    });

    expect(response.status).toBe(200);
    expect(await tokenFor(authUser.id)).toBe(existingToken);
    expect(client.cookies.has('Authorization')).toBe(true);
    expect(client.cookies.get('Authorization')?.value).toBe(existingToken);
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

    const logout = await client.post('/api-token-deauth/');
    await assertLogoutResponseIsOk(logout);

    // The token persists after de-authenticating: there is one token per
    // user, shared by all of their browsers.
    expect(await tokenFor(authUser.id)).toBe(existingToken);
    expect(client.cookies.has('Authorization')).toBe(true);
    expect(client.cookies.has('LoggedIn')).toBe(true);
    expect(client.cookies.get('Authorization')?.value).toBe('');
    expect(client.cookies.get('LoggedIn')?.attributes['max-age']).toBe('0');
    // v2 deviation: the expired cookies carry the Domain they were set with,
    // so browsers actually drop the domain-scoped cookies (Django omitted it).
    expect(client.cookies.get('Authorization')?.attributes['domain']).toBe(
      COOKIE_DOMAIN
    );
    expect(client.cookies.get('LoggedIn')?.attributes['domain']).toBe(
      COOKIE_DOMAIN
    );
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

  it('test_invalid_token_passed_to_logout', async () => {
    await userFactory();
    const client = new ApiClient('invalid_token');
    const response = await client.post('/api-token-deauth/');

    await assertLogoutResponseIsOk(response);

    expect(client.cookies.has('Authorization')).toBe(true);
    expect(client.cookies.has('LoggedIn')).toBe(true);
    expect(client.cookies.get('Authorization')?.value).toBe('');
  });
});

// v2: token lookup rules from Django's CustomAuthentication.
describe('TokenAuthentication', () => {
  it('accepts an Authorization header token', async () => {
    const user = await userFactory();
    const response = await new ApiClient().get('/api/v1/user/', {
      Authorization: `Token ${await tokenFor(user.id)}`,
    });
    expect(response.status).toBe(200);
    expect((await json(response)).data.id).toBe(String(user.id));
  });

  it('rejects a malformed or unknown Authorization header', async () => {
    const user = await userFactory();
    const token = await tokenFor(user.id);
    for (const header of [token, `Token ${token} extra`, 'Token unknown']) {
      const response = await new ApiClient().get('/api/v1/user/', {
        Authorization: header,
      });
      expect(response.status).toBe(401);
    }
  });

  it('does not fall back to the header when the cookie is invalid', async () => {
    const user = await userFactory();
    const response = await new ApiClient('invalid_token').get('/api/v1/user/', {
      Authorization: `Token ${await tokenFor(user.id)}`,
    });
    expect(response.status).toBe(401);
  });

  it('issues a new token on login when the user has none', async () => {
    const user = await userFactory();
    const revoked = await tokenFor(user.id);
    await db().delete(tokens).where(eq(tokens.user_id, user.id));
    mockFetch([
      {method: 'POST', url: GOOGLE_TOKEN_URL, body: {access_token: 'token'}},
      {
        method: 'GET',
        url: GOOGLE_USERINFO_URL,
        body: {email: user.email, email_verified: true},
      },
    ]);
    const client = new ApiClient();
    const response = await client.post('/api/v1/google-login/', {
      data: {type: 'GoogleLogin', attributes: {code: 'valid_code'}},
    });
    expect(response.status).toBe(200);
    const issued = await tokenFor(user.id);
    expect(issued).toMatch(/^[0-9a-f]{40}$/);
    expect(issued).not.toBe(revoked);
    expect(client.cookies.get('Authorization')?.value).toBe(issued);
  });

  it('keeps the user logged in across logins (login_count)', async () => {
    const user = await userFactory();
    mockFetch([
      {method: 'POST', url: GOOGLE_TOKEN_URL, body: {access_token: 'token'}},
      {
        method: 'GET',
        url: GOOGLE_USERINFO_URL,
        body: {email: user.email, email_verified: true},
      },
    ]);
    const client = new ApiClient();
    const payload = {
      data: {type: 'GoogleLogin', attributes: {code: 'valid_code'}},
    };
    await client.post('/api/v1/google-login/', payload);
    await client.post('/api/v1/google-login/', payload);
    expect((await refreshUser(user.id))?.login_count).toBe(3);
  });
});
