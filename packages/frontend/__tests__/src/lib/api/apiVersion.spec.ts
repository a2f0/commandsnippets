import {API_VERSION_HEADER} from '@commandsnippets/api-shared/messages';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {getStaffStatus, listUsers} from '../../../../src/lib/api/adminApi';
import {apiClient} from '../../../../src/lib/api/apiClient';
import {
  fetchApi,
  requestName,
  useApiVersion,
} from '../../../../src/lib/api/apiVersion';
import * as envModule from '../../../../src/lib/environment';
import {
  clearMetrics,
  metricsSnapshot,
} from '../../../../src/lib/metrics/timings';

const user = JSON.stringify({
  data: {
    type: 'User',
    id: '1',
    attributes: {
      username: 'test',
      is_staff: false,
      date_updated: '2026-09-01T00:00:00',
      data_version: 1,
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

describe('fetchApi timings', () => {
  beforeEach(() => clearMetrics());

  it('times a request to the end of its body, which the caller still reads', async () => {
    answer('0.2.1');
    const response = await fetchApi('http://localhost:9001/api/v1/user/');

    expect(await response.json()).toEqual(JSON.parse(user));
    await vi.waitFor(() =>
      expect(metricsSnapshot().timings).toEqual([
        expect.objectContaining({
          kind: 'network',
          name: 'GET /user/',
          detail: expect.stringMatching(
            new RegExp(`^200, headers in \\d+ ms, ${user.length} B$`)
          ),
        }),
      ])
    );
  });

  it('neither copies a body nor times a request in production', async () => {
    vi.spyOn(envModule, 'environment', 'get').mockReturnValue('production');
    const clone = vi.spyOn(Response.prototype, 'clone');
    answer('0.2.1');

    await fetchApi('http://localhost:9001/api/v1/user/');
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(clone).not.toHaveBeenCalled();
    expect(metricsSnapshot().timings).toEqual([]);
  });

  it('times a request that failed', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));

    await expect(
      fetchApi('http://localhost:9001/api/v1/tags', {method: 'POST'})
    ).rejects.toThrow('offline');

    await vi.waitFor(() =>
      expect(metricsSnapshot().timings).toEqual([
        expect.objectContaining({name: 'POST /tags', detail: 'failed'}),
      ])
    );
  });
});

describe('requestName', () => {
  it.each([
    ['http://localhost:9001/api/v1/tags?page[after]=x', 'GET', 'GET /tags'],
    ['http://localhost:9001/api/v1/tags/12', 'patch', 'PATCH /tags/:id'],
    [
      'http://localhost:9001/api/v1/tags_entries?filter[tag.id]=3',
      'GET',
      'GET /tags_entries',
    ],
    [
      'http://localhost:9001/api/v1/users/alice/entries',
      'GET',
      'GET /users/:user/entries',
    ],
    [
      'http://localhost:9001/api-token-deauth/',
      'POST',
      'POST /api-token-deauth/',
    ],
  ])('names %s', (url, method, name) => {
    expect(requestName(url, method)).toBe(name);
  });
});
