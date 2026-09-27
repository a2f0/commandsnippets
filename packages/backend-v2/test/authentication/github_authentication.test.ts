import {eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it, vi} from 'vitest';
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
  GITHUB_EMAILS_URL,
  GITHUB_TOKEN_URL,
  GITHUB_USER_URL,
  githubPayload,
  githubRoutes,
  type MockRoute,
  mockFetch,
  requestWithEnv,
} from './support';

const COOKIE_DOMAIN = 'localhost';
const MAX_AGE = '2419200';

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

// tearleads/authentication/tests/test_github_authentication.py
describe('TestGithubAuthentication', () => {
  beforeEach(async () => {
    await setUpBase();
  });

  it('test_successful_github_login_for_new_user', async () => {
    mockFetch(githubRoutes('login', 'user@example.com'));
    const client = new ApiClient();

    // Make sure the user doesn't exist before the login.
    expect(await userByUsername('login')).toBeUndefined();

    const response = await client.post(
      '/api/v1/github-login/',
      githubPayload()
    );

    const user = await userByUsername('login');
    expect(user?.last_login).not.toBeNull();
    expect(user?.last_login).toBe(user?.date_joined);
    expect(user?.login_count).toBe(1);
    const existingToken = await tokenFor(user?.id as number);
    expect(response.status).toBe(200);
    expectAuthCookies(client, existingToken);
  });

  it('test_successful_github_login_for_existing_user', async () => {
    const existingUser = await userFactory({
      username: 'login',
      email: 'user@example.com',
    });
    const oldLoginTime = existingUser.last_login;
    expect(existingUser.login_count).toBe(1);

    mockFetch(githubRoutes('login', 'user@example.com'));
    const client = new ApiClient();

    const userBefore = await userByUsername('login');
    expect(userBefore?.id).toBe(existingUser.id);

    const response = await client.post(
      '/api/v1/github-login/',
      githubPayload()
    );

    const userAfter = await userByUsername('login');
    expect(userAfter?.id).toBe(existingUser.id);
    expect(userAfter?.last_login).not.toBe(oldLoginTime);
    expect(userAfter?.login_count).toBe(2);

    const existingToken = await tokenFor(existingUser.id);
    expect(response.status).toBe(200);
    expectAuthCookies(client, existingToken);
  });
});

// v2: GitHub failure paths. Django returned 401 for most of these and a 500
// when the token response lacked an access_token.
describe('GithubLoginFailures', () => {
  const [tokenRoute, userRoute, emailsRoute] = githubRoutes(
    'login',
    'user@example.com'
  ) as [MockRoute, MockRoute, MockRoute];

  const cases: Array<[string, MockRoute[]]> = [
    ['token endpoint error', [{...tokenRoute, status: 500, body: ''}]],
    [
      'token response without access_token',
      [{...tokenRoute, body: 'error=bad_verification_code'}],
    ],
    ['user endpoint error', [tokenRoute, {...userRoute, status: 401}]],
    [
      'emails endpoint error',
      [tokenRoute, userRoute, {...emailsRoute, status: 500}],
    ],
    [
      'no primary email',
      [
        tokenRoute,
        userRoute,
        {
          ...emailsRoute,
          body: [{email: 'user@example.com', primary: false, verified: true}],
        },
      ],
    ],
  ];

  for (const [name, routes] of cases) {
    it(`returns 401 on ${name}`, async () => {
      mockFetch(routes);
      const client = new ApiClient();
      const response = await client.post(
        '/api/v1/github-login/',
        githubPayload()
      );
      expect(response.status).toBe(401);
      expect(await json(response)).toEqual({errors: []});
      expect(client.cookies.has('Authorization')).toBe(false);
      expect(await userByUsername('login')).toBeUndefined();
    });
  }

  it('validates the code attribute', async () => {
    const client = new ApiClient();
    const missing = await client.post('/api/v1/github-login/', {
      data: {type: 'GithubLogin', attributes: {}},
    });
    expect(missing.status).toBe(400);
    const errors = (await json(missing)).errors;
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      detail: 'This field is required.',
      source: {pointer: '/data/attributes/code'},
    });
  });

  it('suffixes the username when the GitHub login is already taken', async () => {
    await userFactory({username: 'login', email: 'someone-else@example.com'});
    mockFetch(githubRoutes('login', 'user@example.com'));
    const response = await new ApiClient().post(
      '/api/v1/github-login/',
      githubPayload()
    );
    expect(response.status).toBe(200);
    const original = await userByUsername('login');
    expect(original?.email).toBe('someone-else@example.com');
    const [created] = await db()
      .select()
      .from(users)
      .where(eq(users.email, 'user@example.com'));
    expect(created?.username).toMatch(/^login-\d$/);
  });

  // Web-only now: a clientType from an older client is ignored, and the web
  // OAuth app's credentials are always used.
  it('ignores the retired clientType attribute', async () => {
    const calls = mockFetch(githubRoutes('login', 'user@example.com'));
    const response = await new ApiClient().post('/api/v1/github-login/', {
      data: {
        type: 'GithubLogin',
        attributes: {code: 'valid_code', clientType: 'electron'},
      },
    });
    expect(response.status).toBe(200);
    expect(new URLSearchParams(calls[0]?.body).get('client_id')).toBe(
      'github_client_id'
    );
  });

  it('returns a JSON 500 when the OAuth app is not configured', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const response = await requestWithEnv(
      {GITHUB_CLIENT_ID: ''},
      'POST',
      '/api/v1/github-login/',
      githubPayload()
    );
    expect(response.status).toBe(500);
    expect(await json(response)).toEqual({
      errors: [
        {detail: 'A server error occurred.', status: '500', code: 'error'},
      ],
    });
    expect(consoleError).toHaveBeenCalled();
  });

  it('only calls the endpoints it needs', async () => {
    const calls = mockFetch(githubRoutes('login', 'user@example.com'));
    await new ApiClient().post('/api/v1/github-login/', githubPayload());
    expect(calls.map(call => `${call.method} ${call.url}`)).toEqual([
      `POST ${GITHUB_TOKEN_URL}`,
      `GET ${GITHUB_USER_URL}`,
      `GET ${GITHUB_EMAILS_URL}`,
    ]);
    expect(calls[1]?.headers.get('Authorization')).toBe(
      'token test_access_token'
    );
  });
});
