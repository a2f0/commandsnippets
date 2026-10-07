import {CODES, EXPECTED_USER_HEADER} from '@commandsnippets/api-shared';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {
  AdminApiError,
  AdminForbiddenError,
  AdminSignedOutError,
  getStaffStatus,
  listAuditLog,
  listUsers,
  setUserActive,
  setUserMarkedForDeletion,
} from '../../../../src/lib/api/adminApi';
import {UserMismatchError} from '../../../../src/lib/api/apiClient';
import {errorDocument, onePage} from '../../../../src/msw/documents';
import {signIn, TEST_USER} from '../../../util/signIn';

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
    last_active: '2026-01-02T00:00:00.000000',
    login_count: 3,
    date_updated: '2026-01-01T00:00:00.000000',
    date_marked_for_deletion: null,
    is_public: false,
    entry_count: 5,
    tag_count: 2,
    data_version: 1,
    ...overrides,
  },
});

const page = (data: unknown[]) => ({
  ...onePage(`${API}/users`, data.length),
  data,
});

/** GET /user for a user who is (or is not) staff. */
const currentUser = (isStaff: boolean) => ({
  data: {
    type: 'User',
    id: '1',
    attributes: {
      username: 'a',
      is_staff: isStaff,
      date_updated: '2026-01-01T00:00:00',
      data_version: 1,
    },
  },
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
    expect(parsed.search).toBe(
      '?page%5Bnumber%5D=2&page%5Bsize%5D=25&sort=-last_login' +
        '&filter%5Bsearch%5D=ali&filter%5Bis_active%5D=false'
    );
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
          lastActive: '2026-01-02T00:00:00.000000',
          loginCount: 3,
          dateMarkedForDeletion: null,
          entryCount: 5,
          tagCount: 2,
          dataVersion: 1,
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

  it('patches marked_for_deletion with a JSON:API document', async () => {
    const fetchSpy = reply(200, {
      data: userResource({
        is_active: false,
        date_marked_for_deletion: '2026-09-28T12:00:00.000000',
      }),
    });

    const user = await setUserMarkedForDeletion('7', true);

    const {url, init} = requestOf(fetchSpy);
    expect(url).toBe(`${API}/users/7`);
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toEqual({
      data: {
        type: 'AdminUser',
        id: '7',
        attributes: {marked_for_deletion: true},
      },
    });
    expect(user.isActive).toBe(false);
    expect(user.dateMarkedForDeletion).toBe('2026-09-28T12:00:00.000000');
  });

  it('names the signed-in user in a write, and not in a read', async () => {
    signIn();
    const fetchSpy = reply(200, {data: userResource({is_active: false})});
    await setUserActive('7', false);
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(page([])), {}));
    await listUsers({
      search: '',
      status: 'all',
      sort: 'username',
      descending: false,
      page: 1,
      pageSize: 25,
    });

    const named = fetchSpy.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get(EXPECTED_USER_HEADER)
    );
    expect(named).toEqual([TEST_USER, null]);
  });

  it("raises UserMismatchError when the session is another user's", async () => {
    signIn();
    reply(409, errorDocument(409, CODES.userMismatch, 'Not that user.'));

    const change = setUserActive('7', false);

    await expect(change).rejects.toBeInstanceOf(UserMismatchError);
    await expect(change).rejects.toMatchObject({username: TEST_USER});
    expect(loggedOut()).toBe(false);
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
    reply(
      403,
      errorDocument(
        403,
        CODES.permissionDenied,
        'You do not have permission to perform this action.'
      )
    );
    await expect(setUserActive('7', false)).rejects.toBeInstanceOf(
      AdminForbiddenError
    );
    expect(loggedOut()).toBe(false);
  });

  it('logs out when the session is gone', async () => {
    reply(
      403,
      errorDocument(
        403,
        CODES.notAuthenticated,
        'Authentication credentials were not provided.'
      )
    );
    await expect(listAuditLog(1, 25)).rejects.toBeInstanceOf(AdminApiError);
    expect(loggedOut()).toBe(true);
  });

  it('keeps the session on a 403 that is not about it', async () => {
    reply(
      403,
      errorDocument(403, CODES.originNotAllowed, 'Origin not allowed.')
    );
    await expect(setUserActive('7', false)).rejects.toThrow(
      'Origin not allowed.'
    );
    expect(loggedOut()).toBe(false);
  });

  it('logs out on a 401 or a 403 without a code, like every other call', async () => {
    reply(401, {errors: []});
    await expect(listAuditLog(1, 25)).rejects.toBeInstanceOf(AdminApiError);
    expect(loggedOut()).toBe(true);

    vi.mocked(console.info).mockClear();
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('Forbidden', {status: 403})
    );
    await expect(listAuditLog(1, 25)).rejects.toBeInstanceOf(AdminApiError);
    expect(loggedOut()).toBe(true);
  });

  it("reports the API's error detail", async () => {
    reply(
      400,
      errorDocument(
        400,
        CODES.invalid,
        'You cannot deactivate your own account.'
      )
    );
    await expect(setUserActive('1', false)).rejects.toThrow(
      'You cannot deactivate your own account.'
    );
  });

  it('reads the staff flag from /user', async () => {
    const fetchSpy = reply(200, currentUser(true));
    expect(await getStaffStatus()).toBe(true);
    expect(requestOf(fetchSpy).url).toBe('http://localhost:9001/api/v1/user/');
    expect(requestOf(fetchSpy).init?.credentials).toBe('include');

    vi.restoreAllMocks();
    reply(200, currentUser(false));
    expect(await getStaffStatus()).toBe(false);
  });

  it('rejects a /user response that is not a user document', async () => {
    reply(200, {data: {type: 'User', id: '1', attributes: {username: 'a'}}});
    const result = getStaffStatus();
    await expect(result).rejects.toBeInstanceOf(AdminApiError);
    await expect(result).rejects.toThrow(
      'Invalid admin API response: data.attributes.is_staff: '
    );
    expect(loggedOut()).toBe(false);
  });

  it('reports an expired session (401) as signed out', async () => {
    reply(401, {errors: []});
    await expect(getStaffStatus()).rejects.toBeInstanceOf(AdminSignedOutError);
  });

  const allUsers = () =>
    listUsers({
      search: '',
      status: 'all',
      sort: 'username',
      descending: false,
      page: 1,
      pageSize: 25,
    });

  it('rejects responses of the wrong shape, keeping the session', async () => {
    reply(200, page([userResource({is_active: 'yes'})]));
    const result = allUsers();
    await expect(result).rejects.toBeInstanceOf(AdminApiError);
    await expect(result).rejects.toThrow(
      'Invalid admin API response: data.0.attributes.is_active: '
    );
    expect(loggedOut()).toBe(false);
  });

  it('rejects a page without pagination, and a body that is not JSON', async () => {
    reply(200, {data: [userResource()], links: {}});
    await expect(allUsers()).rejects.toThrow(
      /^Invalid admin API response: links\.first: /
    );

    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('<h1>OK</h1>', {status: 200})
    );
    await expect(listAuditLog(1, 25)).rejects.toThrow(
      'Invalid admin API response: (document): '
    );
  });

  it('accepts an audit log entry with an action it does not know', async () => {
    reply(
      200,
      page([
        {
          type: 'AdminAuditLogEntry',
          id: '1',
          attributes: {
            created: '2026-09-28T12:00:00',
            action: 'delete_user',
            actor_id: null,
            actor_username: 'a2f0',
            target_user_id: null,
            target_username: 'alice',
          },
        },
      ])
    );
    const {items} = await listAuditLog(1, 25);
    expect(items.map(entry => entry.action)).toEqual(['delete_user']);
  });

  it('rejects a changed user that is not an AdminUser', async () => {
    reply(200, {data: {...userResource(), type: 'User'}});
    await expect(setUserActive('7', false)).rejects.toThrow(
      'Invalid admin API response: data.type: '
    );
  });
});
