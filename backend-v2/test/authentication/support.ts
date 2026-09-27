/**
 * Test support for the auth tests: a `responses`-style outbound HTTP mock and
 * a way to call the app with a modified environment.
 */
import {env} from 'cloudflare:workers';
import {vi} from 'vitest';
import {app} from '../../src/app';

export interface MockRoute {
  method: 'GET' | 'POST';
  url: string;
  status?: number;
  body: string | object;
  contentType?: string;
}

export interface MockCall {
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

export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_USER_URL = 'https://api.github.com/user';
export const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL =
  'https://www.googleapis.com/oauth2/v3/userinfo';

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

export function githubPayload(clientType = 'web', code = 'valid_code') {
  return {data: {type: 'GithubLogin', attributes: {code, clientType}}};
}

/** Call the app with overridden bindings (e.g. DEBUG or missing secrets). */
export async function requestWithEnv(
  overrides: Partial<Cloudflare.Env>,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<Response> {
  return await app.request(
    `http://localhost${path}`,
    {
      method,
      headers: {'Content-Type': 'application/vnd.api+json', ...headers},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    },
    {...env, ...overrides}
  );
}

/** Parse every Set-Cookie header into name -> lowercase attribute map. */
export function setCookies(
  response: Response
): Record<string, {value: string; attributes: Record<string, string | true>}> {
  const cookies: Record<
    string,
    {value: string; attributes: Record<string, string | true>}
  > = {};
  for (const header of response.headers.getSetCookie()) {
    const [pair = '', ...parts] = header.split(';').map(part => part.trim());
    const separator = pair.indexOf('=');
    const attributes: Record<string, string | true> = {};
    for (const part of parts) {
      const index = part.indexOf('=');
      if (index === -1) {
        attributes[part.toLowerCase()] = true;
      } else {
        attributes[part.slice(0, index).toLowerCase()] = part.slice(index + 1);
      }
    }
    cookies[pair.slice(0, separator)] = {
      value: pair.slice(separator + 1),
      attributes,
    };
  }
  return cookies;
}
