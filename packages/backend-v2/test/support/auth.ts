/**
 * Test support for the auth tests: a `responses`-style outbound HTTP mock,
 * canned OAuth provider answers, a way to call the app with a modified
 * environment, and the auth cookies' expected attributes.
 */
import {env} from 'cloudflare:workers';
import {expect, vi} from 'vitest';
import {
  GITHUB_EMAILS_URL,
  GITHUB_TOKEN_URL,
  GITHUB_USER_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
} from '../../src/auth/oauth';
import {ApiClient, setCookieHeaders} from './client';

export {
  GITHUB_EMAILS_URL,
  GITHUB_TOKEN_URL,
  GITHUB_USER_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
};

/** Django's AUTH_COOKIE_MAX_AGE (28 days), as the cookies' Max-Age. */
export const COOKIE_MAX_AGE = '2419200';

/** The tests' COOKIE_DOMAIN binding (vitest.config.ts). */
export const COOKIE_DOMAIN = 'localhost';

export interface MockRoute {
  method: 'GET' | 'POST';
  url: string;
  status?: number;
  body: string | object;
  contentType?: string;
}

interface MockCall {
  url: string;
  method: string;
  headers: Headers;
  body: string;
}

/**
 * Replace globalThis.fetch (the app runs in the test isolate) with canned
 * responses, recording every call. Unmatched requests fail loudly.
 */
export function mockFetch(routes: MockRoute[]): MockCall[] {
  const calls: MockCall[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    const call = {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: await request.text(),
    };
    calls.push(call);
    const route = routes.find(
      candidate =>
        candidate.method === call.method && candidate.url === call.url
    );
    if (route === undefined) {
      throw new Error(`Unexpected fetch: ${call.method} ${call.url}`);
    }
    return new Response(
      typeof route.body === 'string' ? route.body : JSON.stringify(route.body),
      {
        status: route.status ?? 200,
        headers: {'Content-Type': route.contentType ?? 'application/json'},
      }
    );
  });
  return calls;
}

/** Google's code exchange and userinfo answering for a verified `email`. */
export function googleRoutes(email: string): MockRoute[] {
  return [
    {method: 'POST', url: GOOGLE_TOKEN_URL, body: {access_token: 'token'}},
    {
      method: 'GET',
      url: GOOGLE_USERINFO_URL,
      body: {email, email_verified: true},
    },
  ];
}

export function googlePayload(code = 'code') {
  return {data: {type: 'GoogleLogin', attributes: {code}}};
}

/** The three GitHub endpoints answering successfully for `login`/`email`. */
export function githubRoutes(
  login: string,
  email: string,
  accessToken = 'test_access_token'
): MockRoute[] {
  return [
    {
      method: 'POST',
      url: GITHUB_TOKEN_URL,
      body: `access_token=${accessToken}&scope=user%3Aemail&token_type=bearer`,
      contentType: 'application/x-www-form-urlencoded',
    },
    {method: 'GET', url: GITHUB_USER_URL, body: {login}},
    {
      method: 'GET',
      url: GITHUB_EMAILS_URL,
      body: [{email, primary: true, verified: true}],
    },
  ];
}

export function githubPayload(code = 'valid_code') {
  return {data: {type: 'GithubLogin', attributes: {code}}};
}

/** Call the app with overridden bindings (e.g. DEBUG or missing secrets). */
export function requestWithEnv(
  overrides: Partial<Cloudflare.Env>,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<Response> {
  return new ApiClient(undefined, {...env, ...overrides}).request(
    method,
    path,
    body,
    headers
  );
}

/**
 * A response's cookies by name (the last Set-Cookie of a name wins), values
 * as sent (not URL-decoded).
 */
export function setCookies(
  response: Response
): Record<string, {value: string; attributes: Record<string, string | true>}> {
  const cookies: Record<
    string,
    {value: string; attributes: Record<string, string | true>}
  > = {};
  for (const {name, value, attributes} of setCookieHeaders(response)) {
    cookies[name] = {value, attributes};
  }
  return cookies;
}

/** A successful login's cookies in the client's jar, carrying `token`. */
export function expectAuthCookies(client: ApiClient, token: string) {
  expect(client.cookies.has('Authorization')).toBe(true);
  expect(client.cookies.get('Authorization')?.value).toBe(token);
  expect(client.cookies.get('Authorization')?.attributes['domain']).toBe(
    COOKIE_DOMAIN
  );
  expect(client.cookies.get('Authorization')?.attributes['max-age']).toBe(
    COOKIE_MAX_AGE
  );
  expect(client.cookies.has('LoggedIn')).toBe(true);
  expect(client.cookies.get('LoggedIn')?.attributes['max-age']).toBe(
    COOKIE_MAX_AGE
  );
  expect(client.cookies.get('LoggedIn')?.attributes['domain']).toBe(
    COOKIE_DOMAIN
  );
  expect(client.cookies.get('Authorization')?.value).not.toBe('');
}
