import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {
  AdminApiError,
  AdminForbiddenError,
  AdminSignedOutError,
  getStaffStatus,
  listAuditLog,
  listUsers,
  setUserActive,
} from '../../../../src/lib/api/adminApi';

const API = 'http://localhost:9001/api/v1/admin';

const userResource = (overrides: Record<string, unknown> = {}) => ({
  type: 'AdminUser',
  id: '7',
  attributes: {
    username: 'alice',
    email: 'alice@example.com',
    first_name: '',
    last_name: '',
    is_staff: false,
    is_active: true,
    date_joined: '2026-01-01T00:00:00.000000',
    last_login: null,
    login_count: 3,
    date_updated: '2026-01-01T00:00:00.000000',
    entry_count: 5,
    tag_count: 2,
    ...overrides,
  },
});

const page = (data: unknown[]) => ({
  data,
  links: {},
  meta: {pagination: {page: 1, pages: 1, count: data.length}},
});

const reply = (status: number, body: unknown) =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), {status}));

const requestOf = (fetchSpy: ReturnType<typeof reply>) => {
  const [url, init] = fetchSpy.mock.calls[0] ?? [];
  return {url: String(url), init};
};

describe('adminApi', () => {
  // handleUnauthorized (log out) announces itself on console.info.
  const loggedOut = () =>
    vi
      .mocked(console.info)
      .mock.calls.some(
        ([message]) =>
          message ===
          'Unauthorized access detected, resetting application state'
      );

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists users with the query as JSON:API parameters, sending the cookie', async () => {
    const fetchSpy = reply(200, page([userResource()]));

    const result = await listUsers({
      search: '  ali ',
      status: 'inactive',
      sort: 'last_login',
      descending: true,
      page: 2,
      pageSize: 25,
    });

    const {url, init} = requestOf(fetchSpy);
    const parsed = new URL(url);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(`${API}/users`);
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      'page[number]': '2',
      'page[size]': '25',
      sort: '-last_login',
      'filter[search]': 'ali',
      'filter[is_active]': 'false',
    });
    expect(init?.credentials).toBe('include');
    expect(result).toEqual({
      items: [
        {
          id: '7',
          username: 'alice',
          email: 'alice@example.com',
          isStaff: false,
          isActive: true,
          dateJoined: '2026-01-01T00:00:00.000000',
          lastLogin: null,
          loginCount: 3,
          entryCount: 5,
          tagCount: 2,
        },
      ],
      page: 1,
      pages: 1,
      count: 1,
    });
  });

  it('leaves out empty search and the "all" status', async () => {
    const fetchSpy = reply(200, page([]));
    await listUsers({
      search: '   ',
      status: 'all',
      sort: 'username',
      descending: false,
      page: 1,
      pageSize: 50,
    });
    const params = new URL(requestOf(fetchSpy).url).searchParams;
    expect(params.has('filter[search]')).toBe(false);
    expect(params.has('filter[is_active]')).toBe(false);
    expect(params.get('sort')).toBe('username');
  });

  it('patches is_active with a JSON:API document', async () => {
    const fetchSpy = reply(200, {data: userResource({is_active: false})});

    const user = await setUserActive('7', false);

    const {url, init} = requestOf(fetchSpy);
    expect(url).toBe(`${API}/users/7`);
    expect(init?.method).toBe('PATCH');
    expect(init?.credentials).toBe('include');
    expect(JSON.parse(String(init?.body))).toEqual({
      data: {type: 'AdminUser', id: '7', attributes: {is_active: false}},
    });
    expect(user.isActive).toBe(false);
  });

  it('lists the audit log', async () => {
    const fetchSpy = reply(
      200,
      page([
        {
          type: 'AdminAuditLogEntry',
          id: '1',
          attributes: {
            created: '2026-09-28T12:00:00.000000',
            action: 'deactivate_user',
            actor_id: '1',
            actor_username: 'a2f0',
            target_user_id: '7',
            target_username: 'alice',
          },
        },
      ])
    );

    const result = await listAuditLog(3, 25);

    expect(new URL(requestOf(fetchSpy).url).search).toBe(
      '?page%5Bnumber%5D=3&page%5Bsize%5D=25'
    );
    expect(result.items).toEqual([
      {
        id: '1',
        created: '2026-09-28T12:00:00.000000',
        action: 'deactivate_user',
        actorUsername: 'a2f0',
        targetUsername: 'alice',
      },
    ]);
  });

  it('turns permission_denied into AdminForbiddenError without logging out', async () => {
    reply(403, {
      errors: [
        {code: 'permission_denied', detail: 'You do not have permission'},
      ],
    });
    await expect(setUserActive('7', false)).rejects.toBeInstanceOf(
      AdminForbiddenError
    );
    expect(loggedOut()).toBe(false);
  });

  it('logs out when the session is gone', async () => {
    reply(403, {
      errors: [{code: 'not_authenticated', detail: 'No credentials'}],
    });
    await expect(listAuditLog(1, 25)).rejects.toBeInstanceOf(AdminApiError);
    expect(loggedOut()).toBe(true);
  });

  it("reports the API's error detail", async () => {
    reply(400, {
      errors: [
        {code: 'invalid', detail: 'You cannot deactivate your own account.'},
      ],
    });
    await expect(setUserActive('1', false)).rejects.toThrow(
      'You cannot deactivate your own account.'
    );
  });

  it('reads the staff flag from /user', async () => {
    const fetchSpy = reply(200, {
      data: {
        type: 'User',
        id: '1',
        attributes: {username: 'a', is_staff: true},
      },
    });
    expect(await getStaffStatus()).toBe(true);
    expect(requestOf(fetchSpy).url).toBe('http://localhost:9001/api/v1/user/');
    expect(requestOf(fetchSpy).init?.credentials).toBe('include');

    vi.restoreAllMocks();
    reply(200, {data: {type: 'User', id: '1', attributes: {username: 'a'}}});
    expect(await getStaffStatus()).toBe(false);
  });

  it('reports an expired session (401) as signed out', async () => {
    reply(401, {errors: []});
    await expect(getStaffStatus()).rejects.toBeInstanceOf(AdminSignedOutError);
  });

  it('rejects responses of the wrong shape', async () => {
    reply(200, page([userResource({is_active: 'yes'})]));
    await expect(
      listUsers({
        search: '',
        status: 'all',
        sort: 'username',
        descending: false,
        page: 1,
        pageSize: 25,
      })
    ).rejects.toThrow('Invalid admin API response: is_active');
  });
});
