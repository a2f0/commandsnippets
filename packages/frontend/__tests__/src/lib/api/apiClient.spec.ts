import type {
  TagDocument,
  TagTextEntryDocument,
  TextEntryDocument,
  UserDocument,
} from '@commandsnippets/api-shared';
import invariant from 'invariant';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {apiClient} from '../../../../src/lib/api/apiClient';
import {InvalidResponseError} from '../../../../src/lib/api/parseResponse';
import {setUnauthorizedHandler} from '../../../../src/lib/auth/authUtils';
import {entriesResponse} from '../../../../test/mocks/entries/entriesResponse';
import {tagsResponse} from '../../../../test/mocks/tags/tagsResponse';

const API = 'http://localhost:9001/api/v1';

// Documents the API could answer with (see test/mocks), one per endpoint.
const [tag] = tagsResponse.data;
const [entry] = entriesResponse.data;
const junction = entriesResponse.included?.find(
  resource => resource.type === 'TagTextEntryThroughModel'
);
const user = tagsResponse.included?.[0];
invariant(tag && entry && junction && user, 'the fixtures have each resource');
invariant(user.type === 'User', 'the tags fixture includes the user');

const userDocument: UserDocument = {data: user};
const tagDocument: TagDocument = {data: tag, included: [user]};
const entryDocument: TextEntryDocument = {data: entry, included: [user]};
const junctionDocument: TagTextEntryDocument = {
  data: junction,
  included: [user, tag, entry],
};

interface Call {
  name: string;
  call: () => Promise<unknown>;
  /** What the API answers: the status and the JSON body (none if absent). */
  status: number;
  body?: unknown;
  /**
   * For the methods that return the body: one that breaks the contract, and
   * what the error's message starts with.
   */
  malformed?: {body: unknown; failure: string};
}

const calls: Call[] = [
  {
    name: 'googleLogin',
    call: () => apiClient.googleLogin('code'),
    status: 200,
    body: {},
  },
  {
    name: 'githubLogin',
    call: () => apiClient.githubLogin('code'),
    status: 200,
    body: {},
  },
  {
    name: 'getCurrentUser',
    call: () => apiClient.getCurrentUser(),
    status: 200,
    body: userDocument,
    malformed: {
      // What the API sent before is_staff.
      body: {data: {...user, attributes: {username: 'test'}}},
      failure: 'Failed to fetch user',
    },
  },
  {
    name: 'logout',
    call: () => apiClient.logout(),
    status: 200,
    body: {},
    malformed: {body: {data: {}}, failure: 'Logout failed'},
  },
  {
    name: 'createTag',
    call: () => apiClient.createTag('name'),
    status: 201,
    body: tagDocument,
    malformed: {
      body: {data: {...tag, relationships: {}}},
      failure: 'Failed to create tag',
    },
  },
  {
    name: 'deleteTag',
    call: () => apiClient.deleteTag('1'),
    status: 200,
    body: tagDocument,
    malformed: {
      body: {data: {...tag, attributes: {...tag.attributes, is_deleted: 1}}},
      failure: 'Failed to delete tag',
    },
  },
  {
    name: 'updateTag',
    call: () => apiClient.updateTag('1', 'name'),
    status: 200,
    body: tagDocument,
    malformed: {
      body: {data: {...tag, id: 1}},
      failure: 'Failed to update tag',
    },
  },
  {
    name: 'createEntry',
    call: () => apiClient.createEntry('s', 'b'),
    status: 201,
    body: entryDocument,
    malformed: {
      body: {data: {...entry, type: 'Tag'}},
      failure: 'Failed to create entry',
    },
  },
  {
    name: 'updateEntry',
    call: () => apiClient.updateEntry('1', 's', 'b'),
    status: 200,
    body: entryDocument,
    malformed: {
      body: {
        data: {
          ...entry,
          attributes: {...entry.attributes, date_updated: 'yesterday'},
        },
      },
      failure: 'Failed to update entry',
    },
  },
  {
    name: 'getEntries',
    call: () =>
      apiClient.getEntries({
        'page[number]': 1,
        'filter[user.username]': 'u',
        signal: new AbortController().signal,
      }),
    status: 200,
    body: entriesResponse,
    malformed: {
      // No pagination: the old mocks' `links: {next: null}`.
      body: {...entriesResponse, links: {next: null}},
      failure: 'Failed to fetch entries',
    },
  },
  {
    name: 'getTags',
    call: () =>
      apiClient.getTags({
        'page[number]': 1,
        'filter[user.username]': 'u',
        sort: 'date_updated',
      }),
    status: 200,
    body: tagsResponse,
    malformed: {
      body: {...tagsResponse, included: []},
      failure: 'Failed to fetch tags',
    },
  },
  {
    name: 'tagEntry',
    call: () => apiClient.tagEntry('1', '2'),
    status: 201,
    body: junctionDocument,
    malformed: {
      body: {
        data: {
          ...junction,
          relationships: {
            ...junction.relationships,
            tag: {data: {type: 'test-tag-2', id: '2'}},
          },
        },
      },
      failure: 'Failed to tag entry',
    },
  },
  {
    name: 'untagEntry',
    call: () => apiClient.untagEntry('1'),
    status: 204,
  },
  {
    name: 'deleteEntry',
    call: () => apiClient.deleteEntry('1'),
    status: 200,
    body: entryDocument,
  },
  {
    name: 'reorderTag',
    call: () =>
      apiClient.reorderTag({
        data: {
          type: 'Tag',
          attributes: {top: '1', bottom: '2'},
          relationships: {},
        },
      }),
    status: 200,
  },
  {
    name: 'reorderEntry',
    call: () => apiClient.reorderEntry('1', '2'),
    status: 200,
  },
];

/** Answer every fetch with `status` and `body` (JSON, or no body). */
function reply(status: number, body?: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
      })
  );
}

const signOut = vi.fn();

beforeEach(() => {
  setUnauthorizedHandler(signOut);
});

afterEach(() => {
  signOut.mockReset();
  vi.restoreAllMocks();
});

// Every API route is owner-only (reads included), so every request must send
// the auth cookie to the API's origin.
describe('apiClient credentials', () => {
  it.each(calls)(
    '$name sends credentials: include',
    async ({call, status, body}) => {
      const fetchSpy = reply(status, body);
      await call();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const init = fetchSpy.mock.calls[0]?.[1];
      expect(init?.credentials).toBe('include');
    }
  );
});

describe('apiClient requests', () => {
  // The request documents are api-shared's; the requests are what they were.
  const requests: Array<[string, () => Promise<unknown>, string, unknown]> = [
    [
      'googleLogin',
      () => apiClient.googleLogin('code'),
      `${API}/google-login/`,
      {data: {type: 'GoogleLogin', attributes: {code: 'code'}}},
    ],
    [
      // No clientType: backend-v2 ignores it, and the contract leaves it out.
      'githubLogin',
      () => apiClient.githubLogin('code'),
      `${API}/github-login/`,
      {data: {type: 'GithubLogin', attributes: {code: 'code'}}},
    ],
    [
      'createTag',
      () => apiClient.createTag('name'),
      `${API}/tags`,
      {data: {type: 'Tag', attributes: {name: 'name'}}},
    ],
    [
      'updateTag',
      () => apiClient.updateTag('3', 'name'),
      `${API}/tags/3`,
      {data: {id: '3', type: 'Tag', attributes: {name: 'name'}}},
    ],
    [
      // No user relationship: the entry is the requester's.
      'createEntry',
      () => apiClient.createEntry('s', 'b'),
      `${API}/entries`,
      {data: {type: 'TextEntry', attributes: {subject: 's', body: 'b'}}},
    ],
    [
      'updateEntry',
      () => apiClient.updateEntry('4', 's', 'b'),
      `${API}/entries/4`,
      {
        data: {
          id: '4',
          type: 'TextEntry',
          attributes: {subject: 's', body: 'b'},
        },
      },
    ],
    [
      'tagEntry',
      () => apiClient.tagEntry('1', '2'),
      `${API}/tags_entries`,
      {
        data: {
          type: 'TagTextEntryThroughModel',
          attributes: {},
          relationships: {
            tag: {data: {id: '1', type: 'Tag'}},
            text_entry: {data: {id: '2', type: 'TextEntry'}},
          },
        },
      },
    ],
    [
      'reorderEntry',
      () => apiClient.reorderEntry('1', '2'),
      `${API}/tags_entries/reorder`,
      {
        data: {
          type: 'TagTextEntryThroughModel',
          attributes: {top: '1', bottom: '2'},
          relationships: {},
        },
      },
    ],
  ];

  it.each(requests)('%s sends its document', async (name, call, url, body) => {
    const response = calls.find(candidate => candidate.name === name);
    invariant(response, `${name} has a response`);
    const fetchSpy = reply(response.status, response.body);
    await call();
    const [requested, init] = fetchSpy.mock.calls[0] ?? [];
    expect(requested).toBe(url);
    expect(JSON.parse(String(init?.body))).toEqual(body);
  });
});

describe('apiClient responses', () => {
  const parsing = calls.flatMap(({malformed, ...call}) =>
    malformed === undefined ? [] : [{...call, malformed}]
  );

  it.each(parsing)(
    '$name returns the document it parsed',
    async ({call, status, body}) => {
      reply(status, body);
      await expect(call()).resolves.toEqual(body);
    }
  );

  it.each(parsing)(
    '$name rejects a response that breaks the contract, keeping the session',
    async ({call, status, malformed}) => {
      reply(status, malformed.body);
      const result = call();
      await expect(result).rejects.toBeInstanceOf(InvalidResponseError);
      await expect(result).rejects.toThrow(
        `${malformed.failure}: invalid response (`
      );
      expect(signOut).not.toHaveBeenCalled();
    }
  );

  it.each(parsing)(
    '$name rejects a body that is not JSON',
    async ({call, status, malformed}) => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(
        async () => new Response('<h1>OK</h1>', {status})
      );
      await expect(call()).rejects.toThrow(
        new InvalidResponseError(
          `${malformed.failure}: invalid response (not JSON)`
        )
      );
      expect(signOut).not.toHaveBeenCalled();
    }
  );

  it('says where the document breaks the contract', async () => {
    reply(200, {data: {...tag, attributes: {...tag.attributes, name: 7}}});
    const error = await apiClient.deleteTag('1').catch((e: unknown) => e);
    invariant(error instanceof InvalidResponseError, 'an InvalidResponseError');
    expect(error.message).toBe(
      'Failed to delete tag: invalid response (data.attributes.name: ' +
        'Invalid input: expected string, received number)'
    );
    expect(error.issues).toHaveLength(1);
  });

  it('counts the issues it does not describe', async () => {
    reply(200, {data: {}});
    await expect(apiClient.getCurrentUser()).rejects.toThrow(
      /^Failed to fetch user: invalid response \(data\.type: .*; data\.id: .*; data\.attributes: .*\)$/
    );

    reply(200, {links: {}, meta: {}, data: {}});
    await expect(
      apiClient.getTags({
        'page[number]': 1,
        'filter[user.username]': 'u',
        sort: 'order',
      })
    ).rejects.toThrow(/; and 3 more\)$/);
  });

  it('takes an OK logout with no body', async () => {
    reply(200);
    await expect(apiClient.logout()).resolves.toEqual({});
  });

  it('leaves unread the bodies it does not return', async () => {
    // What a call that returns nothing gets back is not its concern.
    for (const {call, status} of calls.filter(
      ({malformed}) => malformed === undefined
    )) {
      // A 204 has no body at all.
      reply(status, status === 204 ? undefined : {unexpected: true});
      await expect(call()).resolves.toBeUndefined();
    }
  });
});
