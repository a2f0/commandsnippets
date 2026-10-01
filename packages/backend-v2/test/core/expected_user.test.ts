import {
  CODES,
  EXPECTED_USER_HEADER,
  EXPECTED_USER_ID_HEADER,
} from '@commandsnippets/api-shared';
import {describe, expect, it} from 'vitest';
import {
  ApiClient,
  json,
  refreshTag,
  setUpBase,
  tagFactory,
  tokenFor,
  userFactory,
} from '../helpers';

const newTag = {data: {type: 'Tag', attributes: {name: 'new tag'}}};

/** `client`'s request naming `username` as the user it acts for. */
const as = (
  client: ApiClient,
  method: string,
  path: string,
  username: string,
  body?: unknown
) =>
  client.request(method, path, body, {
    [EXPECTED_USER_HEADER]: encodeURIComponent(username),
  });

// A browser tab signed in as one user whose cookie another tab replaced
// names the first user; the API refuses its writes, and its reads.
describe('a request naming the user it acts for', () => {
  it('writes when it is the signed-in user', async () => {
    const {user1, user1Client} = await setUpBase();
    const response = await as(
      user1Client,
      'POST',
      '/api/v1/tags',
      user1.username,
      newTag
    );
    expect(response.status).toBe(201);
  });

  it('is refused a write as anyone else, which changes nothing', async () => {
    const {user1, user2, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1});

    const response = await as(
      user1Client,
      'DELETE',
      `/api/v1/tags/${tag.id}`,
      user2.username
    );

    expect(response.status).toBe(409);
    const body = await json(response);
    expect(body.errors[0].code).toBe(CODES.userMismatch);
    expect((await refreshTag(tag.id))?.is_deleted).toBe(false);
  });

  it('is refused a logout as anyone else, keeping the session', async () => {
    const {user1Client} = await setUpBase();
    const response = await user1Client.request(
      'POST',
      '/api-token-deauth/',
      {},
      {'Content-Type': 'application/json', [EXPECTED_USER_HEADER]: 'someone'}
    );
    expect(response.status).toBe(409);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('matches a username of any script, URI-encoded', async () => {
    const user = await userFactory({username: 'jörg-ユーザー'});
    const client = new ApiClient(await tokenFor(user.id));
    const response = await as(client, 'POST', '/api/v1/tags', user.username, {
      data: {type: 'Tag', attributes: {name: 'unicode'}},
    });
    expect(response.status).toBe(201);
  });

  it('is refused when the name is not validly encoded', async () => {
    const {user1Client} = await setUpBase();
    const response = await user1Client.request('POST', '/api/v1/tags', newTag, {
      [EXPECTED_USER_HEADER]: '%E0%A4%A',
    });
    expect(response.status).toBe(409);
  });

  it('reads when it is the signed-in user', async () => {
    const {user1, user1Client} = await setUpBase();
    const response = await as(
      user1Client,
      'GET',
      '/api/v1/tags',
      user1.username
    );
    expect(response.status).toBe(200);
  });

  it("is refused a read as anyone else: no other user's data", async () => {
    const {user1Client} = await setUpBase();
    const response = await as(user1Client, 'GET', '/api/v1/tags', 'someone');
    expect(response.status).toBe(409);
    const body = await json(response);
    expect(body.errors[0].code).toBe(CODES.userMismatch);
    expect(body.data).toBeUndefined();
  });

  it('is refused as another account of the same name (by its id)', async () => {
    const {user1, user1Client} = await setUpBase();
    const named = (id: number) =>
      user1Client.request('POST', '/api/v1/tags', newTag, {
        [EXPECTED_USER_HEADER]: encodeURIComponent(user1.username),
        [EXPECTED_USER_ID_HEADER]: String(id),
      });
    const refused = await named(user1.id + 1000);
    expect(refused.status).toBe(409);
    expect((await json(refused)).errors[0].code).toBe(CODES.userMismatch);
    expect((await named(user1.id)).status).toBe(201);
  });

  it('leaves an anonymous write to the routes', async () => {
    const response = await as(
      new ApiClient(),
      'POST',
      '/api/v1/tags',
      'someone',
      newTag
    );
    expect(response.status).toBe(403);
    const body = await json(response);
    expect(body.errors[0].code).toBe(CODES.notAuthenticated);
  });

  it('may cross origins: the CORS preflight allows the header', async () => {
    const response = await new ApiClient().options('/api/v1/tags', {
      Origin: 'https://app.commandsnippets.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': `content-type,${EXPECTED_USER_HEADER.toLowerCase()}`,
    });
    expect(
      response.headers.get('Access-Control-Allow-Headers')?.split(',')
    ).toContain(EXPECTED_USER_HEADER.toLowerCase());
  });
});
