import {describe, expect, it} from 'vitest';
import RESERVED_USERNAMES from '../../src/services/reserved-usernames.json';
import {createUser, isReservedUsername} from '../../src/services/users';
import {
  googlePayload,
  googleRoutes,
  mockFetch,
} from '../authentication/support';
import {ApiClient, db, userByUsername} from '../helpers';

// v2: usernames are the web app's first path segment, so its own top-level
// routes (/admin, /oauth/...) are never given out.
describe('ReservedUsernames', () => {
  it('reserves the web app routes, in any case', () => {
    expect(RESERVED_USERNAMES).toEqual(['admin', 'oauth']);
    for (const name of ['admin', 'Admin', 'ADMIN', 'oauth', 'OAuth']) {
      expect(isReservedUsername(name)).toBe(true);
    }
    for (const name of ['administrator', 'admin-1', 'oauth2', 'dan']) {
      expect(isReservedUsername(name)).toBe(false);
    }
  });

  it('suffixes a reserved username like a taken one', async () => {
    for (const [name, email] of [
      ['admin', 'a@example.com'],
      ['Admin', 'b@example.com'],
      ['oauth', 'c@example.com'],
    ] as const) {
      const user = await createUser(db(), name, email);
      expect(user.username).toMatch(new RegExp(`^${name}-\\d$`));
    }
    const user = await createUser(db(), 'administrator', 'd@example.com');
    expect(user.username).toBe('administrator');
  });

  it('suffixes it on sign-up through Google', async () => {
    mockFetch(googleRoutes('admin@company.example'));
    const response = await new ApiClient().post(
      '/api/v1/google-login/',
      googlePayload()
    );
    expect(response.status).toBe(200);
    expect(await userByUsername('admin')).toBeUndefined();
  });
});
