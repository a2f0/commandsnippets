import {afterEach, describe, expect, it, vi} from 'vitest';

import {tearleadsApi} from '../../../../src/lib/api/tearleadsApi';

// Every API route is owner-only (reads included), so every request must send
// the auth cookie to the API's origin.
describe('tearleadsApi credentials', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const body = JSON.stringify({
    data: {id: '1', type: 'User', attributes: {username: 'u'}},
    links: {next: null},
    included: [],
  });

  const calls: Array<[string, () => Promise<unknown>]> = [
    ['googleLogin', () => tearleadsApi.googleLogin('code')],
    ['githubLogin', () => tearleadsApi.githubLogin('code')],
    ['getCurrentUser', () => tearleadsApi.getCurrentUser()],
    ['logout', () => tearleadsApi.logout()],
    ['createTag', () => tearleadsApi.createTag('name')],
    ['deleteTag', () => tearleadsApi.deleteTag('1')],
    ['updateTag', () => tearleadsApi.updateTag('1', 'name')],
    ['createEntry', () => tearleadsApi.createEntry('s', 'b', '1')],
    ['updateEntry', () => tearleadsApi.updateEntry('1', 's', 'b')],
    [
      'getEntries',
      () =>
        tearleadsApi.getEntries({
          'page[number]': 1,
          'filter[user.username]': 'u',
          signal: new AbortController().signal,
        }),
    ],
    [
      'getTags',
      () =>
        tearleadsApi.getTags({
          'page[number]': 1,
          'filter[user.username]': 'u',
          sort: 'date_updated',
        }),
    ],
    ['tagEntry', () => tearleadsApi.tagEntry('1', '2')],
    ['untagEntry', () => tearleadsApi.untagEntry('1')],
    ['deleteEntry', () => tearleadsApi.deleteEntry('1')],
    [
      'reorderTag',
      () =>
        tearleadsApi.reorderTag({
          data: {
            type: 'Tag',
            attributes: {top: '1', bottom: '2'},
            relationships: {},
          },
        }),
    ],
    ['reorderEntry', () => tearleadsApi.reorderEntry('1', '2')],
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
    await tearleadsApi.githubLogin('code');
    const init = fetchSpy.mock.calls[0]?.[1];
    expect(JSON.parse(String(init?.body))).toEqual({
      data: {
        type: 'GithubLogin',
        attributes: {code: 'code', clientType: 'web'},
      },
    });
  });
});
