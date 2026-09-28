import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {fetchWithAuth} from '../../../../src/lib/api/fetchWithAuth';
import {setUnauthorizedHandler} from '../../../../src/lib/auth/authUtils';

/** A backend-v2 error document: JSON:API, one error. */
const apiError = (status: number, code: string) =>
  JSON.stringify({
    errors: [
      {
        detail: 'The detail.',
        status: String(status),
        source: {pointer: '/data'},
        code,
      },
    ],
  });

interface Case {
  name: string;
  status: number;
  body: string;
  signsOut: boolean;
}

const cases: Case[] = [
  // `/user` and `/api-token-deauth/` once the session has expired.
  {name: '401', status: 401, body: '{"errors":[]}', signsOut: true},
  {
    name: '403 not_authenticated',
    status: 403,
    body: apiError(403, 'not_authenticated'),
    signsOut: true,
  },
  {
    name: '403 authentication_failed',
    status: 403,
    body: apiError(403, 'authentication_failed'),
    signsOut: true,
  },
  // Signed in, but the object is someone else's.
  {
    name: '403 permission_denied',
    status: 403,
    body: apiError(403, 'permission_denied'),
    signsOut: false,
  },
  // A state-changing request from an origin outside the CORS allowlist.
  {
    name: '403 origin_not_allowed',
    status: 403,
    body: apiError(403, 'origin_not_allowed'),
    signsOut: false,
  },
  {
    name: '403 with any other code',
    status: 403,
    body: apiError(403, 'something_else'),
    signsOut: false,
  },
  // Only the first error counts.
  {
    name: '403 whose first error is permission_denied',
    status: 403,
    body: JSON.stringify({
      errors: [{code: 'permission_denied'}, {code: 'not_authenticated'}],
    }),
    signsOut: false,
  },
  // No code to go by: signed out, as every 403 was before the codes were read
  // (why: `meansSignedOut` in src/lib/api/fetchWithAuth.ts).
  {
    name: '403 without errors',
    status: 403,
    body: '{"error":"Forbidden"}',
    signsOut: true,
  },
  {
    name: '403 with an empty errors list',
    status: 403,
    body: '{"errors":[]}',
    signsOut: true,
  },
  {
    name: '403 whose first error has no code',
    status: 403,
    body: '{"errors":[{"detail":"Forbidden"}]}',
    signsOut: true,
  },
  {
    name: '403 whose code is not a string',
    status: 403,
    body: '{"errors":[{"code":403}]}',
    signsOut: true,
  },
  {
    name: '403 that is not JSON',
    status: 403,
    body: '<h1>Forbidden</h1>',
    signsOut: true,
  },
  {name: '403 with no body', status: 403, body: '', signsOut: true},
  {name: '200', status: 200, body: '{"data":[]}', signsOut: false},
  {
    name: '404 not_authenticated',
    status: 404,
    body: apiError(404, 'not_authenticated'),
    signsOut: false,
  },
  {name: '500', status: 500, body: '', signsOut: false},
];

describe('fetchWithAuth', () => {
  const signOut = vi.fn();

  beforeEach(() => {
    setUnauthorizedHandler(signOut);
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    signOut.mockReset();
    vi.restoreAllMocks();
  });

  async function send({status, body}: Case) {
    const response = new Response(body === '' ? null : body, {status});
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    const init: RequestInit = {method: 'POST', credentials: 'include'};

    const result = await fetchWithAuth('https://api.test/tags', init);

    expect(fetchSpy).toHaveBeenCalledWith('https://api.test/tags', init);
    // The response itself, with its body unread for the caller.
    expect(result).toBe(response);
    expect(result.bodyUsed).toBe(false);
    expect(await result.text()).toBe(body);
  }

  it.each(cases.filter(({signsOut}) => signsOut))(
    'signs out on a $name',
    async testCase => {
      await send(testCase);
      expect(signOut).toHaveBeenCalledTimes(1);
    }
  );

  it.each(cases.filter(({signsOut}) => !signsOut))(
    'keeps the session on a $name',
    async testCase => {
      await send(testCase);
      expect(signOut).not.toHaveBeenCalled();
    }
  );
});
