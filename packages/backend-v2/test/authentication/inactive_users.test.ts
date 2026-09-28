import {eq} from 'drizzle-orm';
import {describe, expect, it} from 'vitest';
import {users} from '../../src/db/schema';
import {
  ApiClient,
  db,
  json,
  refreshUser,
  tokenFor,
  userFactory,
} from '../helpers';
import {
  githubPayload,
  githubRoutes,
  googlePayload,
  googleRoutes,
  mockFetch,
} from '../support/auth';

// v2: deactivated accounts (users.is_active = false) are locked out. Django
// only enforced this on its retired password login.
const deactivate = (id: number, isActive = false) =>
  db().update(users).set({is_active: isActive}).where(eq(users.id, id));

describe('InactiveUsers', () => {
  it("ignores a deactivated account's token, in a cookie or a header", async () => {
    const user = await userFactory();
    const token = await tokenFor(user.id);
    await deactivate(user.id);

    const cookieClient = new ApiClient(token);
    expect((await cookieClient.get('/api/v1/user/')).status).toBe(401);
    const tags = await cookieClient.get('/api/v1/tags');
    expect(tags.status).toBe(403);
    expect((await json(tags)).errors[0].code).toBe('not_authenticated');

    const header = await new ApiClient().get('/api/v1/user/', {
      Authorization: `Token ${token}`,
    });
    expect(header.status).toBe(401);
  });

  it('accepts the token again once the account is reactivated', async () => {
    const user = await userFactory();
    const client = new ApiClient(await tokenFor(user.id));
    await deactivate(user.id);
    expect((await client.get('/api/v1/user/')).status).toBe(401);
    await deactivate(user.id, true);
    expect((await client.get('/api/v1/user/')).status).toBe(200);
  });

  for (const [provider, routes, payload] of [
    ['google', googleRoutes('inactive@example.com'), googlePayload()],
    [
      'github',
      githubRoutes('inactive', 'inactive@example.com'),
      githubPayload(),
    ],
  ] as const) {
    it(`refuses a ${provider} login without recording it or setting cookies`, async () => {
      const user = await userFactory({
        username: 'inactive',
        email: 'inactive@example.com',
      });
      await deactivate(user.id);
      mockFetch([...routes]);
      const client = new ApiClient();

      const response = await client.post(`/api/v1/${provider}-login/`, payload);

      expect(response.status).toBe(403);
      const error = (await json(response)).errors[0];
      expect(error.code).toBe('authentication_failed');
      expect(error.detail).toBe('This account has been deactivated.');
      expect(client.cookies.has('Authorization')).toBe(false);
      expect(client.cookies.has('LoggedIn')).toBe(false);
      const after = await refreshUser(user.id);
      expect(after?.login_count).toBe(user.login_count);
      expect(after?.last_login).toBe(user.last_login);
    });
  }
});
