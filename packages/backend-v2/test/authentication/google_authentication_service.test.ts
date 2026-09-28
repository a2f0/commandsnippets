import {env} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';
import {type Fetcher, GoogleOAuthService} from '../../src/auth/oauth';

interface Call {
  url: string;
  init: RequestInit | undefined;
}

function fakeFetch(body: object): {fetcher: Fetcher; calls: Call[]} {
  const calls: Call[] = [];
  const fetcher: Fetcher = async (url, init) => {
    calls.push({url, init});
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    });
  };
  return {fetcher, calls};
}

// tearleads/authentication/tests/test_google_authentication_service.py
describe('TestGoogleAuthentication', () => {
  it('test_access_token', async () => {
    const {fetcher, calls} = fakeFetch({access_token: 'access_token'});
    const service = new GoogleOAuthService(env, fetcher);
    const response = await service.accessToken('code');
    expect(await response.json()).toEqual({access_token: 'access_token'});

    expect(calls[0]?.url).toBe('https://oauth2.googleapis.com/token');
    expect(calls[0]?.init?.method).toBe('POST');
    const sent = new URLSearchParams(String(calls[0]?.init?.body));
    expect(Object.fromEntries(sent)).toEqual({
      client_id: 'google_client_id',
      code: 'code',
      client_secret: 'google_client_secret',
      redirect_uri: 'google_redirect_uri',
      grant_type: 'authorization_code',
    });
  });

  it('test_user', async () => {
    const {fetcher, calls} = fakeFetch({email: 'user@example.com'});
    const service = new GoogleOAuthService(env, fetcher);
    const response = await service.user('access_token');
    expect(await response.json()).toEqual({email: 'user@example.com'});
    // v2 deviation: the token goes in a Bearer header rather than the query
    // string, keeping it out of URLs and logs.
    expect(calls[0]?.url).toBe('https://www.googleapis.com/oauth2/v3/userinfo');
    expect(new Headers(calls[0]?.init?.headers).get('Authorization')).toBe(
      'Bearer access_token'
    );
  });

  it('requires client credentials', () => {
    expect(
      () => new GoogleOAuthService({...env, GOOGLE_CLIENT_ID: ''})
    ).toThrow(/ImproperlyConfigured: GOOGLE_CLIENT_ID/);
  });
});
