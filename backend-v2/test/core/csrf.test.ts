import {env} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';
import {app} from '../../src/app';
import {GOOGLE_USERINFO_URL, mockFetch} from '../authentication/support';
import {refreshTag, setUpBase, tagFactory, tokenFor} from '../helpers';

const post = (path: string, headers: Record<string, string>, body = '{}') =>
  app.request(`http://localhost${path}`, {method: 'POST', headers, body}, env);

// A cross-site form (or text/plain) POST skips the CORS preflight, and logout's
// SameSite=None expiries would make such a forged logout effective.
describe('cross-site request forgery', () => {
  it.each([
    'application/x-www-form-urlencoded',
    'multipart/form-data; boundary=x',
    'text/plain',
  ])('refuses a %s logout without touching cookies', async contentType => {
    const response = await post('/api-token-deauth/', {
      'Content-Type': contentType,
      Origin: 'https://evil.example',
    });
    expect(response.status).toBe(415);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('refuses a JSON logout from a foreign origin', async () => {
    const response = await post('/api-token-deauth/', {
      'Content-Type': 'application/json',
      Origin: 'https://evil.example',
    });
    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('logs out from our own origins and from clients without an Origin', async () => {
    const clients: Record<string, string>[] = [
      {
        'Content-Type': 'application/json',
        Origin: 'https://commandsnippets.com',
      },
      {'Content-Type': 'application/json', Origin: 'tearleads://app'},
      {'Content-Type': 'application/json'},
    ];
    for (const headers of clients) {
      const response = await post('/api-token-deauth/', headers);
      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
    }
  });

  it('refuses state changes from a foreign origin even with a valid cookie', async () => {
    const {user1} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const response = await app.request(
      `http://localhost/api/v1/tags/${tag.id}`,
      {
        method: 'DELETE',
        headers: {
          Cookie: `Authorization=${await tokenFor(user1.id)}`,
          Origin: 'https://evil.example',
        },
      },
      env
    );
    expect(response.status).toBe(403);
    expect((await refreshTag(tag.id))?.is_deleted).toBe(false);
  });

  it('leaves cross-origin reads to CORS', async () => {
    const response = await app.request(
      'http://localhost/healthcheck/',
      {headers: {Origin: 'https://evil.example'}},
      env
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

// capacitor.config.production.ts sets no server URL, so bundled builds call
// the API from these WebView origins.
describe('bundled native app origins', () => {
  it.each(['capacitor://localhost', 'https://localhost'])(
    'accepts state changes and CORS from %s',
    async origin => {
      const logout = await post('/api-token-deauth/', {
        'Content-Type': 'application/json',
        Origin: origin,
      });
      expect(logout.status).toBe(200);
      expect(logout.headers.get('Access-Control-Allow-Origin')).toBe(origin);

      const preflight = await app.request(
        'http://localhost/api/v1/entries',
        {
          method: 'OPTIONS',
          headers: {
            Origin: origin,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type',
          },
        },
        env
      );
      expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(preflight.headers.get('Access-Control-Allow-Credentials')).toBe(
        'true'
      );
    }
  );

  it('accepts a native login from the iOS origin', async () => {
    mockFetch([
      {
        method: 'GET',
        url: GOOGLE_USERINFO_URL,
        body: {email: 'native@example.com', email_verified: true},
      },
    ]);
    const response = await post(
      '/api/v1/integrated-oauth/',
      {
        'Content-Type': 'application/vnd.api+json',
        Origin: 'capacitor://localhost',
      },
      JSON.stringify({
        data: {
          type: 'IntegratedOAuthLogin',
          attributes: {provider: 'google', token: 'token'},
        },
      })
    );
    expect(response.status).toBe(200);
  });

  it('still refuses lookalike localhost origins', async () => {
    for (const origin of ['https://localhost.evil.com', 'capacitor://evil']) {
      const response = await post('/api-token-deauth/', {
        'Content-Type': 'application/json',
        Origin: origin,
      });
      expect(response.status).toBe(403);
    }
  });
});
