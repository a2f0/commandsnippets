import {env} from 'cloudflare:workers';
import {beforeEach, describe, expect, it} from 'vitest';
import {type Fetcher, GithubOAuthService} from '../../src/auth/oauth';
import type {Bindings} from '../../src/env';
import {setUpBase} from '../helpers';

// Wrangler types vars as literal unions, hence the cast.
const TEST_ENV = {
  ...env,
  GITHUB_CLIENT_ID: 'test_client_id',
  GITHUB_CLIENT_SECRET: 'test_client_secret',
  GITHUB_REDIRECT_URI: 'https://example.com/callback',
  ELECTRON_GITHUB_CLIENT_ID: 'test_electron_client_id',
  ELECTRON_GITHUB_CLIENT_SECRET: 'test_electron_client_secret',
  ELECTRON_GITHUB_REDIRECT_URI: 'tearleads-dev://oauth/github',
} as unknown as Bindings;

interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** A `responses`-style fake: one canned response, every call recorded. */
function fakeFetch(
  body: string | object,
  contentType = 'application/json'
): {fetcher: Fetcher; calls: Call[]} {
  const calls: Call[] = [];
  const fetcher: Fetcher = async (url, init) => {
    calls.push({url, init});
    return new Response(
      typeof body === 'string' ? body : JSON.stringify(body),
      {status: 200, headers: {'Content-Type': contentType}}
    );
  };
  return {fetcher, calls};
}

const sentForm = (call: Call | undefined) =>
  new URLSearchParams(String(call?.init?.body));

const header = (call: Call | undefined, name: string) =>
  new Headers(call?.init?.headers).get(name);

// tearleads/authentication/tests/test_github_authentication_service.py
describe('TestGithubAuthentication', () => {
  beforeEach(async () => {
    await setUpBase();
  });

  it('test_access_token', async () => {
    const {fetcher, calls} = fakeFetch(
      'access_token=access_token&scope=user%3Aemail&token_type=bearer',
      'application/x-www-form-urlencoded'
    );
    const service = new GithubOAuthService(TEST_ENV, 'web', fetcher);
    const response = await service.accessToken('code');
    const qs = new URLSearchParams(await response.text());
    expect(qs.get('access_token')).toBe('access_token');

    expect(calls[0]?.url).toBe('https://github.com/login/oauth/access_token');
    expect(calls[0]?.init?.method).toBe('POST');
    const sent = sentForm(calls[0]);
    expect(sent.has('redirect_uri')).toBe(true);
    expect(sent.get('redirect_uri')).toBe('https://example.com/callback');
    expect(sent.get('client_id')).toBe('test_client_id');
    expect(sent.get('client_secret')).toBe('test_client_secret');
    expect(sent.get('code')).toBe('code');
    // v2: GitHub rejects requests without a User-Agent.
    expect(header(calls[0], 'User-Agent')).toBe('commandsnippets-api');
  });

  it('test_user', async () => {
    const {fetcher, calls} = fakeFetch({login: 'login'});
    const service = new GithubOAuthService(TEST_ENV, 'web', fetcher);
    const response = await service.user('access_token');
    expect(await response.json()).toEqual({login: 'login'});
    expect(calls[0]?.url).toBe('https://api.github.com/user');
    expect(header(calls[0], 'Authorization')).toBe('token access_token');
    expect(header(calls[0], 'User-Agent')).toBe('commandsnippets-api');
  });

  it('test_emails', async () => {
    const {fetcher, calls} = fakeFetch([
      {email: 'user@example.com', primary: true},
    ]);
    const service = new GithubOAuthService(TEST_ENV, 'web', fetcher);
    const response = await service.emails('access_token');
    expect(await response.json()).toEqual([
      {email: 'user@example.com', primary: true},
    ]);
    expect(calls[0]?.url).toBe('https://api.github.com/user/emails');
    expect(header(calls[0], 'Authorization')).toBe('token access_token');
  });

  it('test_electron_client_type_uses_correct_credentials', async () => {
    const {fetcher, calls} = fakeFetch(
      'access_token=electron_access_token&scope=user%3Aemail&token_type=bearer',
      'application/x-www-form-urlencoded'
    );
    const service = new GithubOAuthService(TEST_ENV, 'electron', fetcher);
    const response = await service.accessToken('electron_code');
    const qs = new URLSearchParams(await response.text());
    expect(qs.get('access_token')).toBe('electron_access_token');

    const sent = sentForm(calls[0]);
    expect(sent.has('redirect_uri')).toBe(true);
    expect(sent.get('redirect_uri')).toBe('tearleads-dev://oauth/github');
    expect(sent.get('client_id')).toBe('test_electron_client_id');
    expect(sent.get('client_secret')).toBe('test_electron_client_secret');
    expect(sent.get('code')).toBe('electron_code');
  });

  it('test_web_client_type_uses_correct_credentials', async () => {
    const {fetcher, calls} = fakeFetch(
      'access_token=web_access_token&scope=user%3Aemail&token_type=bearer',
      'application/x-www-form-urlencoded'
    );
    const service = new GithubOAuthService(TEST_ENV, 'web', fetcher);
    const response = await service.accessToken('web_code');
    const qs = new URLSearchParams(await response.text());
    expect(qs.get('access_token')).toBe('web_access_token');

    const sent = sentForm(calls[0]);
    expect(sent.has('redirect_uri')).toBe(true);
    expect(sent.get('redirect_uri')).toBe('https://example.com/callback');
    expect(sent.get('client_id')).toBe('test_client_id');
    expect(sent.get('client_secret')).toBe('test_client_secret');
    expect(sent.get('code')).toBe('web_code');
  });

  // v2: Django raised ImproperlyConfigured for missing settings.
  it('requires credentials for the selected client type', () => {
    expect(
      () =>
        new GithubOAuthService(
          {...TEST_ENV, ELECTRON_GITHUB_CLIENT_ID: ''},
          'electron'
        )
    ).toThrow(/ImproperlyConfigured: ELECTRON_GITHUB_CLIENT_ID/);
    expect(
      () => new GithubOAuthService({...TEST_ENV, GITHUB_CLIENT_SECRET: ''})
    ).toThrow(/ImproperlyConfigured: GITHUB_CLIENT_SECRET/);
  });
});
