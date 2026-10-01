/**
 * Request documents against api-shared's schemas: a document the schema
 * accepts, the API accepts; one it rejects, the API rejects with the same
 * messages (every field's, or the envelope's first). The API also checks what
 * a schema cannot: that pks exist, and that an id matches the URL.
 */
import {
  adminUserUpdateDocumentSchema,
  errorMeta,
  githubLoginDocumentSchema,
  googleLoginDocumentSchema,
  tagCreateDocumentSchema,
  tagReorderDocumentSchema,
  tagTextEntryCreateDocumentSchema,
  tagTextEntryReorderDocumentSchema,
  tagUpdateDocumentSchema,
  textEntryCreateDocumentSchema,
  textEntryReusedCreateDocumentSchema,
  textEntryUpdateDocumentSchema,
} from '@commandsnippets/api-shared';
import {eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import type * as z from 'zod/mini';
import {users} from '../../src/db/schema';
import {
  ApiClient,
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
  userFactory,
} from '../helpers';
import {githubRoutes, mockFetch} from '../support/auth';

/**
 * `schema` and the API agree on every document in `documents`: accepted
 * (with `status`), or rejected with the same error details.
 */
async function expectAgreement(
  schema: z.ZodMiniType,
  send: (document: unknown) => Promise<Response>,
  status: number,
  documents: unknown[]
) {
  for (const document of documents) {
    const label = JSON.stringify(document);
    const result = schema.safeParse(document);
    const response = await send(document);
    if (result.success) {
      expect(response.status, label).toBe(status);
      continue;
    }
    const issues = result.error.issues;
    // The envelope stops at its first error (it points at the document);
    // fields report each failing field.
    const expected =
      errorMeta(issues[0] as z.core.$ZodIssue).pointer === undefined
        ? issues
        : issues.slice(0, 1);
    const body = await json(response);
    expect(response.status, label).toBeGreaterThanOrEqual(400);
    expect(
      body.errors.map((error: Json) => error.detail),
      label
    ).toEqual(expected.map(issue => issue.message));
  }
}

/** Envelope failures every endpoint shares. */
const envelopes = (type: string) => [
  {},
  {data: null},
  {data: []},
  {data: {type: 'Nope', attributes: {}}},
  {data: {attributes: {}}},
  {data: {type, relationships: {x: {data: 'bad'}}}},
];

let base: Base;
let client: ApiClient;

beforeEach(async () => {
  base = await setUpBase();
  client = base.user1Client;
});

describe('Tag documents', () => {
  it('create', async () => {
    await expectAgreement(
      tagCreateDocumentSchema,
      document => client.post('/api/v1/tags', document),
      201,
      [
        ...envelopes('Tag'),
        {data: {type: 'Tag', attributes: {name: ' new '}}},
        {data: {type: 'Tag', attributes: {name: 12}}},
        {data: {type: 'Tag', attributes: {}}},
        {data: {type: 'Tag'}},
        {data: {type: 'Tag', attributes: {name: ''}}},
        {data: {type: 'Tag', attributes: {name: null}}},
        {data: {type: 'Tag', attributes: {name: ['x']}}},
        {data: {type: 'Tag', attributes: {name: 'x'.repeat(25)}}},
        {data: {type: 'Tag', attributes: {name: '😀'.repeat(24)}}},
      ]
    );
  });

  it('update', async () => {
    const [tag] = await tagsOf(base.user1);
    const id = String(tag?.id);
    await expectAgreement(
      tagUpdateDocumentSchema,
      document => client.patch(`/api/v1/tags/${id}`, document),
      200,
      [
        ...envelopes('Tag'),
        {data: {type: 'Tag', attributes: {}}},
        {data: {type: 'Tag', id, attributes: {}}},
        {data: {type: 'Tag', id}},
        {data: {type: 'Tag', id, attributes: {is_deleted: 'yes'}}},
        {data: {type: 'Tag', id, attributes: {name: 'renamed', is_deleted: 0}}},
        {data: {type: 'Tag', id, attributes: {name: '', is_deleted: 'x'}}},
        {data: {type: 'Tag', id, attributes: {is_deleted: null}}},
      ]
    );
  });

  it('reorder', async () => {
    const [top, bottom] = await tagsOf(base.user1);
    await expectAgreement(
      tagReorderDocumentSchema,
      document => client.post('/api/v1/tags/reorder', document),
      200,
      [
        ...envelopes('Tag'),
        {data: {type: 'Tag', attributes: {top: top?.id, bottom: bottom?.id}}},
        {
          data: {
            type: 'Tag',
            attributes: {top: String(bottom?.id), bottom: String(top?.id)},
          },
        },
        {data: {type: 'Tag', attributes: {}}},
        {data: {type: 'Tag', attributes: {top: null, bottom: true}}},
        {data: {type: 'Tag', attributes: {top: 'x', bottom: 1.5}}},
      ]
    );
  });
});

describe('TextEntry documents', () => {
  it('create', async () => {
    await expectAgreement(
      textEntryCreateDocumentSchema,
      document => client.post('/api/v1/entries', document),
      201,
      [
        ...envelopes('TextEntry'),
        {data: {type: 'TextEntry', attributes: {subject: 's', body: 'b'}}},
        {data: {type: 'TextEntry', attributes: {}}},
        {data: {type: 'TextEntry', attributes: {subject: 5, body: true}}},
        {data: {type: 'TextEntry', attributes: {subject: '', body: null}}},
        {
          data: {
            type: 'TextEntry',
            attributes: {subject: 'x'.repeat(256), body: 'x'.repeat(1025)},
          },
        },
        // A queued create's client id: one, blank, or too long.
        {
          data: {
            type: 'TextEntry',
            attributes: {subject: 's', body: 'b', client_id: 'local-1'},
          },
        },
        {
          data: {
            type: 'TextEntry',
            attributes: {subject: 's', body: 'b', client_id: ''},
          },
        },
        {
          data: {
            type: 'TextEntry',
            attributes: {subject: 's', body: 'b', client_id: 'x'.repeat(65)},
          },
        },
      ]
    );
  });

  it('update', async () => {
    const [entry] = await entriesOf(base.user1);
    const id = String(entry?.id);
    await expectAgreement(
      textEntryUpdateDocumentSchema,
      document => client.patch(`/api/v1/entries/${id}`, document),
      200,
      [
        ...envelopes('TextEntry'),
        {data: {type: 'TextEntry', id, attributes: {subject: 'x'}}},
        {data: {type: 'TextEntry', id, attributes: {is_deleted: 'no'}}},
        {
          data: {
            type: 'TextEntry',
            id,
            attributes: {body: '', subject: null, is_deleted: 'maybe'},
          },
        },
      ]
    );
  });
});

describe('TagTextEntryThroughModel documents', () => {
  it('create', async () => {
    const [tag] = await tagsOf(base.user1);
    const entry = await textEntryFactory({user: base.user1});
    const linkage = (type: string, id: unknown) => ({data: {type, id}});
    const document = (relationships: object) => ({
      data: {type: 'TagTextEntryThroughModel', relationships},
    });
    await expectAgreement(
      tagTextEntryCreateDocumentSchema,
      body => client.post('/api/v1/tags_entries', body),
      201,
      [
        ...envelopes('TagTextEntryThroughModel'),
        document({
          tag: linkage('Tag', tag?.id),
          text_entry: linkage('TextEntry', String(entry.id)),
        }),
        document({}),
        document({tag: {data: null}, text_entry: linkage('TextEntry', 'abc')}),
        document({tag: linkage('Tag', -1)}),
      ]
    );
  });

  it('reorder', async () => {
    const tag = await tagFactory({user: base.user1, name: 'ranked'});
    const junction = async (order: number) =>
      tagTextEntryFactory({
        user: base.user1,
        tag,
        text_entry: await textEntryFactory({user: base.user1}),
        order,
      });
    const top = await junction(1);
    const bottom = await junction(2);
    await expectAgreement(
      tagTextEntryReorderDocumentSchema,
      body => client.post('/api/v1/tags_entries/reorder', body),
      200,
      [
        ...envelopes('TagTextEntryThroughModel'),
        {
          data: {
            type: 'TagTextEntryThroughModel',
            attributes: {top: bottom.id, bottom: top.id},
          },
        },
        {data: {type: 'TagTextEntryThroughModel', attributes: {top: top.id}}},
        {
          data: {
            type: 'TagTextEntryThroughModel',
            attributes: {top: [], bottom: {}},
          },
        },
      ]
    );
  });
});

describe('TextEntryReused documents', () => {
  it('create', async () => {
    const [entry] = await entriesOf(base.user1);
    await expectAgreement(
      textEntryReusedCreateDocumentSchema,
      body => client.post('/api/v1/entry_reuses', body),
      201,
      [
        ...envelopes('TextEntryReused'),
        {
          data: {
            type: 'TextEntryReused',
            relationships: {text_entry: {data: {id: entry?.id}}},
          },
        },
        {data: {type: 'TextEntryReused'}},
        {
          data: {
            type: 'TextEntryReused',
            relationships: {text_entry: {data: null}},
          },
        },
      ]
    );
  });
});

describe('AdminUser documents', () => {
  it('update', async () => {
    await db()
      .update(users)
      .set({is_staff: true})
      .where(eq(users.id, base.user1.id));
    const alice = await userFactory({}, {examples: false});
    const id = String(alice.id);
    const document = (attributes: object) => ({
      data: {type: 'AdminUser', id, attributes},
    });
    await expectAgreement(
      adminUserUpdateDocumentSchema,
      body => client.patch(`/api/v1/admin/users/${id}`, body),
      200,
      [
        ...envelopes('AdminUser'),
        document({}),
        document({is_active: 'no'}),
        document({is_active: true}),
        document({is_active: 'x'}),
        document({email: 'x', is_active: 'x'}),
        document({is_active: false, username: 'x'}),
        document({marked_for_deletion: 'x'}),
        document({marked_for_deletion: false}),
        document({marked_for_deletion: 'no', is_active: 'yes'}),
      ]
    );
  });
});

describe('login documents', () => {
  it.each([
    ['github', githubLoginDocumentSchema, 'GithubLogin'],
    ['google', googleLoginDocumentSchema, 'GoogleLogin'],
  ] as const)('%s', async (provider, schema, type) => {
    const send = (body: unknown) =>
      new ApiClient().post(`/api/v1/${provider}-login/`, body);
    await expectAgreement(schema, send, 200, [
      ...envelopes(type),
      {data: {type, attributes: {}}},
      {data: {type, attributes: {code: ''}}},
      {data: {type, attributes: {code: null}}},
      {data: {type, attributes: {code: {}}}},
    ]);
  });

  it('accepts a valid code', async () => {
    const user = await userFactory();
    mockFetch(githubRoutes(user.username, user.email));
    await expectAgreement(
      githubLoginDocumentSchema,
      body => new ApiClient().post('/api/v1/github-login/', body),
      200,
      [
        {
          data: {
            type: 'GithubLogin',
            attributes: {code: ' c ', clientType: 'web'},
          },
        },
      ]
    );
  });
});
