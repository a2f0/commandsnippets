import {beforeEach, describe, expect, it} from 'vitest';
import packageJson from '../../package.json';
import {ApiClient, type Base, isoformat, json, setUpBase} from '../helpers';

// tearleads/users/tests/test_users_api.py
describe('TestUsersApi', () => {
  let base: Base;

  beforeEach(async () => {
    base = await setUpBase();
  });

  it('test_serialization_format', async () => {
    const response = await base.user1Client.get('/api/v1/user/');
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(Object.keys(body.data)).toHaveLength(3);
    expect(body.data.type).toBe('User');
    expect(body.data.id).toBe(String(base.user1.id));
    expect(Object.keys(body.data.attributes)).toHaveLength(2);
    expect(body.data.attributes.username).toBe(base.user1.username);
    expect(body.data.attributes.date_updated).toBe(
      isoformat(base.user1.date_updated)
    );
  });

  it('test_unauthenticated_user', async () => {
    const response = await new ApiClient().get('/api/v1/user/');
    const body = await json(response);
    expect(response.headers.get('API-Version')).toBe(packageJson.version);
    expect(response.status).toBe(401);
    expect(body.errors).toHaveLength(0);
  });
});

// v2: app-level behavior owned by src/app.ts.
describe('AppBehavior', () => {
  it('serves /api/v1/user without the trailing slash', async () => {
    const {user1Client} = await setUpBase();
    expect((await user1Client.get('/api/v1/user')).status).toBe(200);
  });

  it('returns JSON:API 404s (with API-Version) for unknown routes', async () => {
    const response = await new ApiClient().get('/no/such/route');
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.api+json'
    );
    expect(response.headers.get('API-Version')).toBe(packageJson.version);
    expect(await json(response)).toEqual({
      errors: [{detail: 'Not found.', status: '404', code: 'not_found'}],
    });
  });

  it('adds API-Version to error responses raised by handlers', async () => {
    const response = await new ApiClient().get('/api/v1/tags');
    expect(response.status).toBe(403);
    expect(response.headers.get('API-Version')).toBe(packageJson.version);
  });
});
