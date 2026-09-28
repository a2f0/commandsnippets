import {afterEach, describe, expect, it, vi} from 'vitest';

import {apiClient} from '../../../../src/lib/api/apiClient';

// Every API route is owner-only (reads included), so every request must send
// the auth cookie to the API's origin.
describe('apiClient credentials', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const body = JSON.stringify({
    data: {id: '1', type: 'User', attributes: {username: 'u'}},
    links: {next: null},
    included: [],
  });

  const calls: Array<[string, () => Promise<unknown>]> = [
    ['googleLogin', () => apiClient.googleLogin('code')],
    ['githubLogin', () => apiClient.githubLogin('code')],
    ['getCurrentUser', () => apiClient.getCurrentUser()],
    ['logout', () => apiClient.logout()],
    ['createTag', () => apiClient.createTag('name')],
    ['deleteTag', () => apiClient.deleteTag('1')],
    ['updateTag', () => apiClient.updateTag('1', 'name')],
    ['createEntry', () => apiClient.createEntry('s', 'b', '1')],
    ['updateEntry', () => apiClient.updateEntry('1', 's', 'b')],
    [
      'getEntries',
      () =>
        apiClient.getEntries({
          'page[number]': 1,
          'filter[user.username]': 'u',
          signal: new AbortController().signal,
        }),
    ],
    [
      'getTags',
      () =>
        apiClient.getTags({
          'page[number]': 1,
          'filter[user.username]': 'u',
          sort: 'date_updated',
        }),
    ],
    ['tagEntry', () => apiClient.tagEntry('1', '2')],
    ['untagEntry', () => apiClient.untagEntry('1')],
    ['deleteEntry', () => apiClient.deleteEntry('1')],
    [
      'reorderTag',
      () =>
        apiClient.reorderTag({
          data: {
            type: 'Tag',
            attributes: {top: '1', bottom: '2'},
            relationships: {},
          },
        }),
    ],
    ['reorderEntry', () => apiClient.reorderEntry('1', '2')],
  ];

  it.each(calls)('%s sends credentials: include', async (_name, call) => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(body, {status: 200}));
    await call();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0]?.[1];
    expect(init?.credentials).toBe('include');
  });
});

describe('githubLogin', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The Django backend rejects a GitHub login without clientType.
  it('sends clientType web', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('{}', {status: 200}));
    await apiClient.githubLogin('code');
    const init = fetchSpy.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toEqual({
      data: {
        type: 'GithubLogin',
        attributes: {code: 'code', clientType: 'web'},
      },
    });
  });
});
