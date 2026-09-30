import {API_VERSION_HEADER} from '@commandsnippets/api-shared/messages';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {getStaffStatus, listUsers} from '../../../../src/lib/api/adminApi';
import {apiClient} from '../../../../src/lib/api/apiClient';
import {fetchApi, useApiVersion} from '../../../../src/lib/api/apiVersion';

const user = JSON.stringify({
  data: {
    type: 'User',
    id: '1',
    attributes: {
      username: 'test',
      is_staff: false,
      date_updated: '2026-09-01T00:00:00',
    },
  },
});

const notStaff = JSON.stringify({
  errors: [{detail: 'No.', status: '403', code: 'permission_denied'}],
});

/**
 * Answer every request with `status` and `body`, naming API `version` in
 * the header (null: no header).
 */
function answer(version: string | null, status = 200, body = user) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(body, {
        status,
        headers: version === null ? {} : {[API_VERSION_HEADER]: version},
      })
  );
}

const apiVersion = () => useApiVersion.getState().version;

beforeEach(() => useApiVersion.setState({version: null}));
afterEach(() => vi.restoreAllMocks());

describe('fetchApi', () => {
  it('keeps the version a response names', async () => {
    answer('0.2.1');
    await fetchApi('http://localhost:9001/api/v1/user/');
    expect(apiVersion()).toBe('0.2.1');
  });

  it('follows the API to a new version', async () => {
    answer('0.2.1');
    await fetchApi('http://localhost:9001/api/v1/user/');
    answer('0.2.2');
    await fetchApi('http://localhost:9001/api/v1/user/');
    expect(apiVersion()).toBe('0.2.2');
  });

  it('keeps the version an error response names', async () => {
    answer('0.2.1', 500, '{}');
    await fetchApi('http://localhost:9001/api/v1/user/');
    expect(apiVersion()).toBe('0.2.1');
  });

  it('keeps the last version when a response names none', async () => {
    answer('0.2.1');
    await fetchApi('http://localhost:9001/api/v1/user/');
    answer(null, 502, 'Bad Gateway');
    await fetchApi('http://localhost:9001/api/v1/user/');
    expect(apiVersion()).toBe('0.2.1');
  });
});

describe('Every API call keeps the version', () => {
  it.each([
    ['a request that can sign out', () => apiClient.getCurrentUser()],
    ['a login', () => apiClient.googleLogin('code')],
    ["the admin page's staff check", () => getStaffStatus()],
  ])('from %s', async (_, call) => {
    answer('0.2.2');
    await call();
    expect(apiVersion()).toBe('0.2.2');
  });

  it('from an admin request', async () => {
    answer('0.2.2', 403, notStaff);
    await expect(
      listUsers({
        search: '',
        status: 'all',
        sort: 'username',
        descending: false,
        page: 1,
        pageSize: 25,
      })
    ).rejects.toThrow();
    expect(apiVersion()).toBe('0.2.2');
  });
});
