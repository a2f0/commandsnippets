import {eq} from 'drizzle-orm';
import {describe, expect, it} from 'vitest';
import {users} from '../../src/db/schema';
import {ApiClient, db, refreshUser, tokenFor, userFactory} from '../helpers';
import {googlePayload, googleRoutes, mockFetch} from '../support/auth';

/** A user's stored last_active, which every account has from creation on. */
async function lastActive(id: number): Promise<string> {
  const value = (await refreshUser(id))?.last_active;
  if (value === null || value === undefined) {
    throw new Error(`No last_active for user ${id}`);
  }
  return value;
}

// v2: users_user.last_active records each user's latest authenticated request
// or login.
describe('LastActive', () => {
  it('starts at date_joined for a new account', async () => {
    const user = await userFactory();
    expect(user.last_active).toBe(user.date_joined);
  });

  it('advances on every authenticated request, whatever its outcome', async () => {
    const user = await userFactory();
    const joined = await lastActive(user.id);
    const client = new ApiClient(await tokenFor(user.id));

    expect((await client.get('/api/v1/user/')).status).toBe(200);
    const first = await lastActive(user.id);
    expect(first > joined).toBe(true);

    // Not staff: refused, but still a request from this user.
    expect((await client.get('/api/v1/admin/users')).status).toBe(403);
    const second = await lastActive(user.id);
    expect(second > first).toBe(true);

    // Only last_active moves: not the revision clients sync on, nor logins.
    expect(await refreshUser(user.id)).toEqual({...user, last_active: second});
  });

  it('advances for a token in an Authorization header', async () => {
    const user = await userFactory();
    const joined = await lastActive(user.id);
    const response = await new ApiClient().get('/api/v1/user/', {
      Authorization: `Token ${await tokenFor(user.id)}`,
    });
    expect(response.status).toBe(200);
    expect((await lastActive(user.id)) > joined).toBe(true);
  });

  it('is left alone by anonymous, unknown-token and deactivated requests', async () => {
    const user = await userFactory();
    const joined = await lastActive(user.id);
    const token = await tokenFor(user.id);

    await new ApiClient().get('/api/v1/user/');
    await new ApiClient('invalid_token').get('/api/v1/user/');
    expect(await lastActive(user.id)).toBe(joined);

    await db()
      .update(users)
      .set({is_active: false})
      .where(eq(users.id, user.id));
    expect((await new ApiClient(token).get('/api/v1/user/')).status).toBe(401);
    expect(await lastActive(user.id)).toBe(joined);
  });

  it('matches last_login after a login without a token', async () => {
    const user = await userFactory();
    mockFetch(googleRoutes(user.email));
    const response = await new ApiClient().post(
      '/api/v1/google-login/',
      googlePayload()
    );
    expect(response.status).toBe(200);
    const after = await refreshUser(user.id);
    expect(after?.last_login).not.toBe(user.last_login);
    expect(after?.last_active).toBe(after?.last_login);
  });
});
