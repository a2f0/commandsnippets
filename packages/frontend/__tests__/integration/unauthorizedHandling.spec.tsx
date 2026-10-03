import {CURSOR_START, type TagDocument} from '@commandsnippets/api-shared';
import {act} from '@testing-library/react';
import {HttpResponse, http} from 'msw';
import {setupServer} from 'msw/node';
import {vi} from 'vitest';

import {listUsers} from '../../src/lib/api/adminApi';
import {apiClient} from '../../src/lib/api/apiClient';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {signIn, store} from '../util/signIn';

const API = 'http://localhost:9001/api/v1';

/** A backend-v2 error document (JSON:API) with one error. */
const apiError = (status: number, code: string, detail: string) =>
  HttpResponse.json(
    {
      errors: [
        {detail, status: String(status), source: {pointer: '/data'}, code},
      ],
    },
    {status}
  );

const tag: TagDocument = {
  data: {
    id: '1',
    type: 'Tag',
    attributes: {
      name: 'new-tag',
      date_created: '2026-09-28T12:00:00',
      date_last_used: '2026-09-28T12:00:00',
      date_updated: '2026-09-28T12:00:00.000001',
      is_public: false,
      entry_count: 0,
      order: 1,
      is_deleted: false,
    },
    relationships: {user: {data: {id: '1', type: 'User'}}},
  },
};

const server = setupServer();

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  // handleUnauthorized announces itself on console.info.
  vi.spyOn(console, 'info').mockImplementation(() => {});
  act(() => {
    store.setLoggedInUser('testuser');
    store.setIsStaff(true);
    store.setSelectedTheme('lightTheme');
    store.setTagSortOrder('name');
    store.setEntryNew('some-entry');
  });
});

const announcedSignOut = () =>
  vi
    .mocked(console.info)
    .mock.calls.some(
      ([message]) =>
        message === 'Unauthorized access detected, resetting application state'
    );

/** The store is back to its defaults: the user is signed out of the app. */
function expectSignedOut() {
  expect(announcedSignOut()).toBe(true);
  expect(store.loggedInUser).toBeNull();
  expect(store.isStaff).toBe(false);
  expect(store.selectedTheme).toBe('darkTheme');
  expect(store.tagSortOrder).toBe('order');
  expect(store.entryNew).toBeNull();
}

function expectStillSignedIn() {
  expect(announcedSignOut()).toBe(false);
  expect(store.loggedInUser).toBe('testuser');
  expect(store.isStaff).toBe(true);
  expect(store.selectedTheme).toBe('lightTheme');
  expect(store.tagSortOrder).toBe('name');
  expect(store.entryNew).toBe('some-entry');
}

interface Case {
  name: string;
  response: () => Response;
  signsOut: boolean;
  /** What createTag throws; the sign-out rules do not change it. */
  error?: string;
}

const cases: Case[] = [
  {
    // What `/user` and `/api-token-deauth/` answer once the session expired.
    name: '401',
    response: () => HttpResponse.json({errors: []}, {status: 401}),
    signsOut: true,
    error: 'Failed to create tag: Unauthorized',
  },
  {
    // An anonymous or expired request to a resource endpoint.
    name: '403 not_authenticated',
    response: () =>
      apiError(
        403,
        'not_authenticated',
        'Authentication credentials were not provided.'
      ),
    signsOut: true,
    error: 'Failed to create tag: Forbidden',
  },
  {
    name: '403 authentication_failed',
    response: () =>
      apiError(
        403,
        'authentication_failed',
        'This account has been deactivated.'
      ),
    signsOut: true,
    error: 'Failed to create tag: Forbidden',
  },
  {
    // Signed in, but the object is someone else's.
    name: '403 permission_denied',
    response: () =>
      apiError(
        403,
        'permission_denied',
        'You do not have permission to perform this action.'
      ),
    signsOut: false,
    error: 'Failed to create tag: Forbidden',
  },
  {
    // The request came from an origin outside the API's CORS allowlist.
    name: '403 origin_not_allowed',
    response: () => apiError(403, 'origin_not_allowed', 'Origin not allowed.'),
    signsOut: false,
    error: 'Failed to create tag: Forbidden',
  },
  {
    // No code to go by: signed out, as every 403 was before the codes were
    // read (why: `meansSignedOut` in src/lib/api/fetchWithAuth.ts).
    name: '403 with no parsable code',
    response: () => HttpResponse.json({error: 'Forbidden'}, {status: 403}),
    signsOut: true,
    error: 'Failed to create tag: Forbidden',
  },
  {
    name: '200',
    response: () => HttpResponse.json(tag, {status: 200}),
    signsOut: false,
  },
];

describe('Signing out when the API says the session is gone', () => {
  it.each(cases)(
    'createTag answered with a $name',
    async ({response, signsOut, error}) => {
      server.use(http.post(`${API}/tags`, response));

      const result = apiClient.createTag('new-tag');
      if (error === undefined) {
        // The caller still reads the body.
        await expect(result).resolves.toEqual(tag);
      } else {
        await expect(result).rejects.toThrow(error);
      }

      if (signsOut) {
        expectSignedOut();
      } else {
        expectStillSignedIn();
      }
    }
  );

  it('keeps the session when an OK response breaks the contract', async () => {
    server.use(
      http.post(`${API}/tags`, () =>
        HttpResponse.json({data: {id: '1', type: 'Tag'}}, {status: 201})
      ),
      http.get(`${API}/user/`, () => HttpResponse.json({data: null}))
    );

    await expect(apiClient.createTag('new-tag')).rejects.toThrow(
      'Failed to create tag: invalid response ('
    );
    await expect(apiClient.getCurrentUser()).rejects.toThrow(
      'Failed to fetch user: invalid response ('
    );
    expectStillSignedIn();
  });

  it('signs out when /user answers 401 (the session expired)', async () => {
    server.use(
      http.get(`${API}/user/`, () =>
        HttpResponse.json({errors: []}, {status: 401})
      )
    );

    await expect(apiClient.getCurrentUser()).rejects.toThrow(
      'Failed to fetch user: Unauthorized'
    );
    expectSignedOut();
  });

  it('signs out when the logout answers 401', async () => {
    server.use(
      http.post('http://localhost:9001/api-token-deauth/', () =>
        HttpResponse.json({errors: []}, {status: 401})
      )
    );

    await expect(apiClient.logout()).rejects.toThrow('Logout failed');
    expectSignedOut();
  });

  it("signs out when the sync's reads are not authenticated", async () => {
    server.use(
      http.get(`${API}/tags`, () =>
        apiError(
          403,
          'not_authenticated',
          'Authentication credentials were not provided.'
        )
      ),
      http.get(`${API}/entries`, () =>
        apiError(
          403,
          'not_authenticated',
          'Authentication credentials were not provided.'
        )
      )
    );

    await expect(apiClient.getTagsAfter(CURSOR_START)).rejects.toThrow();
    expectSignedOut();

    act(() => store.setLoggedInUser('testuser'));
    await expect(apiClient.getEntriesAfter(CURSOR_START)).rejects.toThrow();
    expect(store.loggedInUser).toBeNull();
  });

  it("leaves the user this tab has taken up since when an earlier user's answer is late", async () => {
    let sent = false;
    let answer = () => {};
    server.use(
      http.get(`${API}/tags`, async () => {
        sent = true;
        await new Promise<void>(resolve => {
          answer = resolve;
        });
        return HttpResponse.json({errors: []}, {status: 401});
      })
    );
    const read = apiClient.getTagsAfter(CURSOR_START);
    await vi.waitFor(() => expect(sent).toBe(true));

    // Meanwhile this tab takes up another tab's sign-in.
    act(() => store.setLoggedInUser('someone-else'));
    answer();

    await expect(read).rejects.toThrow('Unauthorized');
    expect(store.loggedInUser).toBe('someone-else');
    expect(store.selectedTheme).toBe('lightTheme');
  });

  it("keeps the session when an entry is someone else's", async () => {
    server.use(
      http.patch(`${API}/entries/7`, () =>
        apiError(
          403,
          'permission_denied',
          'You do not have permission to perform this action.'
        )
      )
    );

    await expect(apiClient.updateEntry('7', 'subject', 'body')).rejects.toThrow(
      'Failed to update entry: Forbidden'
    );
    expectStillSignedIn();
  });

  it('signs out when the admin API says the session is gone', async () => {
    server.use(
      http.get(`${API}/admin/users`, () =>
        apiError(
          403,
          'not_authenticated',
          'Authentication credentials were not provided.'
        )
      )
    );

    await expect(
      listUsers({
        search: '',
        status: 'all',
        sort: 'username',
        descending: false,
        page: 1,
        pageSize: 25,
      })
    ).rejects.toThrow('Authentication credentials were not provided.');
    expectSignedOut();
  });
});
