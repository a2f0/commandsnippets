import {describe, expect, it, vi} from 'vitest';
import {requestWithEnv, setCookies} from '../authentication/support';
import {json, setUpBase, tagsOf} from '../helpers';

const tagPayload = {data: {type: 'Tag', attributes: {name: 'via-form'}}};

// A cross-origin `text/plain` (or form) POST is a "simple" request: no CORS
// preflight, so the allowlist would never apply. Bodies must be JSON.
describe('request media types', () => {
  it('rejects a text/plain body before touching data', async () => {
    const {user1, user1Client} = await setUpBase();
    const before = (await tagsOf(user1)).length;
    const response = await user1Client.request(
      'POST',
      '/api/v1/tags',
      tagPayload,
      {
        'Content-Type': 'text/plain',
      }
    );
    expect(response.status).toBe(415);
    expect((await json(response)).errors[0]).toMatchObject({
      detail: 'Unsupported media type "text/plain" in request.',
      code: 'unsupported_media_type',
    });
    expect((await tagsOf(user1)).length).toBe(before);
  });

  it('rejects a login posted as text/plain without calling the provider', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await requestWithEnv(
      {},
      'POST',
      '/api/v1/google-login/',
      {data: {type: 'GoogleLogin', attributes: {code: 'attacker-code'}}},
      {'Content-Type': 'text/plain;charset=UTF-8'}
    );
    expect(response.status).toBe(415);
    expect(setCookies(response)).toEqual({});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects form posts and a missing media type', async () => {
    const {user1Client} = await setUpBase();
    for (const contentType of ['application/x-www-form-urlencoded', '']) {
      const response = await user1Client.request(
        'POST',
        '/api/v1/tags',
        tagPayload,
        {'Content-Type': contentType}
      );
      expect(response.status).toBe(415);
    }
  });

  it('accepts application/json as well as JSON:API', async () => {
    const {user1Client} = await setUpBase();
    const response = await user1Client.request(
      'POST',
      '/api/v1/tags',
      tagPayload,
      {
        'Content-Type': 'application/json; charset=utf-8',
      }
    );
    expect(response.status).toBe(201);
  });
});
