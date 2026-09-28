import type {TagDocument} from '@commandsnippets/api-shared';
import {act} from '@testing-library/react';
import {applySnapshot} from 'mobx-state-tree';
import {HttpResponse, http} from 'msw';
import {setupServer} from 'msw/node';
import {vi} from 'vitest';

import {listUsers} from '../../src/lib/api/adminApi';
import {apiClient} from '../../src/lib/api/apiClient';
import {defaultState} from '../../src/lib/shared';
import {store} from '../../src/lib/store/store';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';

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
  act(() => {
    applySnapshot(store, defaultState);
  });
});
afterAll(() => server.close());
beforeEach(() => {
  assignLoggedInCookie();
  // handleUnauthorized announces itself on console.info.
  vi.spyOn(console, 'info').mockImplementation(() => {});
  act(() => {
    applySnapshot(store, {
      ...defaultState,
      loggedInUser: 'testuser',
      isStaff: true,
      selectedTheme: 'lightTheme',
      tagSortOrder: 'name',
      entryNew: 'some-entry',
    });
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
        await expect(result).rejects.toThrow(new Error(error));
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

  it('signs out when reading tags or entries is not authenticated', async () => {
    const notAuthenticated = () =>
      apiError(
        403,
        'not_authenticated',
        'Authentication credentials were not provided.'
      );
    server.use(
      http.get(`${API}/tags`, notAuthenticated),
      http.get(`${API}/entries`, notAuthenticated)
    );

    await expect(
      apiClient.getTags({
        'filter[user.username]': 'testuser',
        'page[number]': 1,
        sort: 'order',
      })
    ).rejects.toThrow('Failed to fetch tags: Forbidden');
    expectSignedOut();

    act(() => {
      applySnapshot(store, {...defaultState, loggedInUser: 'testuser'});
    });
    await expect(
      apiClient.getEntries({
        'filter[user.username]': 'testuser',
        'page[number]': 1,
      })
    ).rejects.toThrow('Failed to fetch entries: Forbidden');
    expect(store.loggedInUser).toBeNull();
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
