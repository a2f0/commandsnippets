import {env} from 'cloudflare:workers';
import {describe, expect, it} from 'vitest';
import {app} from '../../src/app';
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
