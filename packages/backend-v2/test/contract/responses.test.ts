/**
 * The API's responses against api-shared's schemas, the contract clients
 * parse them with: every success document parses with its endpoint's schema
 * and loses nothing in parsing (no member the schema does not know), and
 * every error response is an error document.
 */
import {
  adminAuditLogListDocumentSchema,
  adminUserDocumentSchema,
  adminUserListDocumentSchema,
  CURSOR_START,
  emptyObjectSchema,
  errorDocumentSchema,
  tagCursorListDocumentSchema,
  tagDocumentSchema,
  tagListDocumentSchema,
  tagSchema,
  tagTextEntryCursorListDocumentSchema,
  tagTextEntryDocumentSchema,
  tagTextEntryListDocumentSchema,
  textEntryCursorListDocumentSchema,
  textEntryDocumentSchema,
  textEntryListDocumentSchema,
  textEntryReusedDocumentSchema,
  textEntryReusedListDocumentSchema,
  userDocumentSchema,
} from '@commandsnippets/api-shared';
import {eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import * as z from 'zod/mini';
import {users} from '../../src/db/schema';
import {
  ApiClient,
  appRequest,
  type Base,
  db,
  entriesOf,
  type Json,
  json,
  setUpBase,
  tagFactory,
  tagsOf,
  tagTextEntryFactory,
  textEntryFactory,
  textEntryReusedFactory,
  tokenFor,
  userFactory,
} from '../helpers';
import {
  githubPayload,
  githubRoutes,
  mockFetch,
  requestWithEnv,
} from '../support/auth';

/** `response` has `status` and a body `schema` parses without loss. */
async function expectDocument(
  schema: z.ZodMiniType,
  response: Response,
  status = 200
): Promise<Json> {
  expect(response.status).toBe(status);
  const body = await json(response);
  const result = schema.safeParse(body);
  expect(result.error?.issues ?? []).toEqual([]);
  expect(result.data).toEqual(body);
  return body;
}

/** An error response: `status`, as an error document. */
async function expectError(response: Response, status: number) {
  const body = await expectDocument(errorDocumentSchema, response, status);
  for (const error of body.errors) {
    expect(error.status).toBe(String(status));
  }
  return body;
}

let base: Base;
let client: ApiClient;

beforeEach(async () => {
  base = await setUpBase();
  client = base.user1Client;
});

describe('the shared schemas', () => {
  it("use this package's zod (one copy, in tests and the bundle)", () => {
    expect(Object.getPrototypeOf(tagSchema)).toBe(
      Object.getPrototypeOf(z.object({}))
    );
  });
});

describe('User', () => {
  it('GET /api/v1/user', async () => {
    await expectDocument(userDocumentSchema, await client.get('/api/v1/user'));
    await expectDocument(
      userDocumentSchema,
      await client.get('/api/v1/user/?include=')
    );
    await expectError(
      await base.unauthenticatedClient.get('/api/v1/user'),
      401
    );
  });
});

describe('Tag', () => {
  it('lists, with and without includes, across pages', async () => {
    await tagFactory({user: base.user1, name: 'third'});
    const list = await expectDocument(
      tagListDocumentSchema,
      await client.get('/api/v1/tags')
    );
    expect(list.included.length).toBe(1);
    await expectDocument(
      tagListDocumentSchema,
      await client.get('/api/v1/tags?include=user&sort=-name')
    );
    const page = await expectDocument(
      tagListDocumentSchema,
      await client.get('/api/v1/tags?page[size]=1&page[number]=2&include=')
    );
    expect(page.links.prev).not.toBeNull();
    expect(page.links.next).not.toBeNull();
    await expectDocument(
      tagListDocumentSchema,
      await client.get('/api/v1/tags?filter[name]=nothing')
    );
  });

  it('reads, creates, updates and deletes', async () => {
    const [tag] = await tagsOf(base.user1);
    const url = `/api/v1/tags/${tag?.id}`;
    await expectDocument(tagDocumentSchema, await client.get(url));
    await expectDocument(
      tagDocumentSchema,
      await client.post('/api/v1/tags', {
        data: {type: 'Tag', attributes: {name: 'new'}},
      }),
      201
    );
    await expectDocument(
      tagDocumentSchema,
      await client.patch(url, {
        data: {type: 'Tag', id: String(tag?.id), attributes: {name: 'renamed'}},
      })
    );
    await expectDocument(
      tagDocumentSchema,
      await client.put(`${url}?include=`, {
        data: {type: 'Tag', id: String(tag?.id), attributes: {}},
      })
    );
    const deleted = await expectDocument(
      tagDocumentSchema,
      await client.delete(url)
    );
    expect(deleted.data.attributes.is_deleted).toBe(true);
  });

  it('reorders, with an empty 200', async () => {
    const [top, bottom] = await tagsOf(base.user1);
    const response = await client.post('/api/v1/tags/reorder', {
      data: {type: 'Tag', attributes: {top: top?.id, bottom: bottom?.id}},
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });
});

describe('TextEntry', () => {
  it('lists, with the default and requested includes', async () => {
    const list = await expectDocument(
      textEntryListDocumentSchema,
      await client.get('/api/v1/entries')
    );
    expect(
      new Set(list.included.map((resource: Json) => resource.type))
    ).toEqual(new Set(['TagTextEntryThroughModel', 'Tag', 'User']));
    for (const include of [
      'text_entry_to_tag.text_entry.text_entry_to_tag',
      'text_entry_to_tag.tag.user,user',
      '',
    ]) {
      await expectDocument(
        textEntryListDocumentSchema,
        await client.get(`/api/v1/entries?include=${include}`)
      );
    }
    await expectDocument(
      textEntryListDocumentSchema,
      await client.get('/api/v1/entries?filter[search]=postgres&sort=-subject')
    );
  });

  it('reads, creates, updates and deletes', async () => {
    const [entry] = await entriesOf(base.user1);
    const url = `/api/v1/entries/${entry?.id}`;
    await expectDocument(textEntryDocumentSchema, await client.get(url));
    await expectDocument(
      textEntryDocumentSchema,
      await client.post('/api/v1/entries', {
        data: {type: 'TextEntry', attributes: {subject: 's', body: 'b'}},
      }),
      201
    );
    await expectDocument(
      textEntryDocumentSchema,
      await client.patch(url, {
        data: {
          type: 'TextEntry',
          id: String(entry?.id),
          attributes: {subject: 'x'},
        },
      })
    );
    await expectDocument(textEntryDocumentSchema, await client.delete(url));
  });
});

describe('TagTextEntryThroughModel', () => {
  it('creates (with all three ends included), reorders and deletes', async () => {
    const tag = await tagFactory({user: base.user1, name: 'fresh'});
    const [entry] = await entriesOf(base.user1);
    const created = await expectDocument(
      tagTextEntryDocumentSchema,
      await client.post('/api/v1/tags_entries', {
        data: {
          type: 'TagTextEntryThroughModel',
          relationships: {
            tag: {data: {type: 'Tag', id: String(tag.id)}},
            text_entry: {data: {type: 'TextEntry', id: String(entry?.id)}},
          },
        },
      }),
      201
    );
    expect(
      created.included.map((resource: Json) => resource.type).sort()
    ).toEqual(['Tag', 'TextEntry', 'User']);

    const other = await tagTextEntryFactory({
      user: base.user1,
      tag,
      text_entry: await textEntryFactory({user: base.user1}),
    });
    const reorder = await client.post('/api/v1/tags_entries/reorder', {
      data: {
        type: 'TagTextEntryThroughModel',
        attributes: {top: other.id, bottom: created.data.id},
      },
    });
    expect(reorder.status).toBe(200);

    const deleted = await client.delete(
      `/api/v1/tags_entries/${created.data.id}`
    );
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe('');
  });

  it('lists, deleted ones too, numbered or after a cursor', async () => {
    const tag = await tagFactory({user: base.user1});
    const text_entry = await textEntryFactory({user: base.user1});
    await tagTextEntryFactory({user: base.user1, tag, text_entry});
    await tagTextEntryFactory({
      user: base.user1,
      tag: await tagFactory({user: base.user1}),
      text_entry,
      is_deleted: true,
    });
    const listed = await expectDocument(
      tagTextEntryListDocumentSchema,
      await client.get('/api/v1/tags_entries?include=text_entry')
    );
    expect(
      listed.data.map((junction: Json) => junction.attributes.is_deleted)
    ).toContain(true);
    const page = await expectDocument(
      tagTextEntryCursorListDocumentSchema,
      await client.get(
        `/api/v1/tags_entries?page[after]=${CURSOR_START}&page[size]=1`
      )
    );
    expect(page.data).toHaveLength(1);
    expect(page.links.next).toContain('page%5Bafter%5D=');
  });
});

describe('keyset pages', () => {
  it('of tags and entries parse as keyset documents', async () => {
    const tags = await expectDocument(
      tagCursorListDocumentSchema,
      await client.get(`/api/v1/tags?page[after]=${CURSOR_START}`)
    );
    expect(tags.data.length).toBeGreaterThan(0);
    expect(tags.links).toEqual({next: null});
    const entries = await expectDocument(
      textEntryCursorListDocumentSchema,
      await client.get(
        `/api/v1/entries?page[after]=${CURSOR_START}&page[size]=1`
      )
    );
    expect(entries.data).toHaveLength(1);
    expect(entries.included.length).toBeGreaterThan(0);
  });
});

describe('TextEntryReused', () => {
  it('creates, lists, reads and deletes', async () => {
    const [entry] = await entriesOf(base.user1);
    await textEntryReusedFactory({
      user: base.user1,
      text_entry: entry as never,
    });
    const created = await expectDocument(
      textEntryReusedDocumentSchema,
      await client.post('/api/v1/entry_reuses', {
        data: {
          type: 'TextEntryReused',
          relationships: {
            text_entry: {data: {type: 'TextEntry', id: String(entry?.id)}},
          },
        },
      }),
      201
    );
    await expectDocument(
      textEntryReusedListDocumentSchema,
      await client.get('/api/v1/entry_reuses?sort=-date_created')
    );
    await expectDocument(
      textEntryReusedListDocumentSchema,
      await client.get(
        '/api/v1/entry_reuses?include=text_entry.text_entry_to_tag.tag,user'
      )
    );
    await expectDocument(
      textEntryReusedDocumentSchema,
      await client.get(
        `/api/v1/entry_reuses/${created.data.id}?include=text_entry,user`
      )
    );
    const deleted = await client.delete(
      `/api/v1/entry_reuses/${created.data.id}`
    );
    expect(deleted.status).toBe(204);
  });
});

describe('the admin API', () => {
  it('lists and reads users, changes one, and lists the audit log', async () => {
    await db()
      .update(users)
      .set({is_staff: true})
      .where(eq(users.id, base.user1.id));
    const alice = await userFactory({}, {examples: false});
    await expectDocument(
      adminUserListDocumentSchema,
      await client.get(
        '/api/v1/admin/users?sort=-entry_count&filter[search]=user'
      )
    );
    await expectDocument(
      adminUserDocumentSchema,
      await client.get(`/api/v1/admin/users/${alice.id}`)
    );
    for (const attributes of [
      {is_active: false},
      {is_active: true},
      {marked_for_deletion: true},
      {marked_for_deletion: false},
    ]) {
      await expectDocument(
        adminUserDocumentSchema,
        await client.patch(`/api/v1/admin/users/${alice.id}`, {
          data: {type: 'AdminUser', id: String(alice.id), attributes},
        })
      );
    }
    const log = await expectDocument(
      adminAuditLogListDocumentSchema,
      await client.get('/api/v1/admin/audit_log')
    );
    expect(log.data.length).toBe(4);
    await expectDocument(
      adminAuditLogListDocumentSchema,
      await client.get(
        `/api/v1/admin/audit_log?filter[target_user_id]=${alice.id}`
      )
    );
  });
});

describe('authentication', () => {
  it('logs in and out with an empty object, or fails with an error document', async () => {
    const user = await userFactory();
    mockFetch(githubRoutes(user.username, user.email));
    const login = await new ApiClient().post(
      '/api/v1/github-login/',
      githubPayload()
    );
    expect(login.status).toBe(200);
    expect(emptyObjectSchema.parse(await json(login))).toEqual({});
    const logout = await new ApiClient().post('/api-token-deauth/');
    expect(emptyObjectSchema.parse(await json(logout))).toEqual({});

    // An unconfigured provider is a 500, logged.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expectError(
      await requestWithEnv(
        {GITHUB_CLIENT_ID: ''},
        'POST',
        '/api/v1/github-login/',
        githubPayload()
      ),
      500
    );
  });
});

describe('errors', () => {
  it('are error documents, whatever their cause', async () => {
    const other = new ApiClient(await tokenFor(base.user2.id));
    const [tag] = await tagsOf(base.user1);
    const cases: Array<[Promise<Response>, number]> = [
      // Serializer fields: every field's error.
      [
        client.post('/api/v1/entries', {
          data: {type: 'TextEntry', attributes: {}},
        }),
        400,
      ],
      // Document envelopes.
      [client.post('/api/v1/tags', {}), 400],
      [client.post('/api/v1/tags', {data: {type: 'Nope'}}), 409],
      // Query parameters.
      [client.get('/api/v1/tags?sort=nope'), 400],
      [client.get('/api/v1/tags?include=nope'), 400],
      [client.get('/api/v1/tags?page[number]=9'), 404],
      // Everything else.
      [client.get('/api/v1/tags/999999'), 404],
      [client.get('/no/such/route'), 404],
      [other.get(`/api/v1/tags/${tag?.id}`), 403],
      [base.unauthenticatedClient.get('/api/v1/tags'), 403],
      [client.get('/api/v1/admin/users'), 403],
      [client.get('/api/v1/tags_entries/1'), 405],
      [client.get('/api/v1/tags?page[after]=nope'), 400],
      [client.get('/api/v1/entry_reuses?page[after]=1970-01-01,0'), 400],
      [
        appRequest('/api/v1/tags', {
          method: 'POST',
          body: '{}',
          headers: {'Content-Type': 'text/plain'},
        }),
        415,
      ],
    ];
    for (const [response, status] of cases) {
      await expectError(await response, status);
    }
  });
});
