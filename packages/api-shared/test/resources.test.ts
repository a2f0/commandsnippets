import {describe, expect, test} from 'bun:test';
import type {z} from 'zod';
import {
  ADMIN_USER_SORT_FIELDS,
  type AdminAuditLogListDocument,
  type AdminUserUpdateDocument,
  adminAuditLogListDocumentSchema,
  adminAuditLogListQuerySchema,
  adminUserListQuerySchema,
  adminUserUpdateAttributesSchema,
  DEFAULT_INCLUDES,
  emptyObjectSchema,
  errorDocumentSchema,
  type GithubLoginDocument,
  includedResourceSchema,
  includeSchema,
  loginAttributesSchema,
  RELATIONSHIPS,
  type TagCreateDocument,
  type TagDocument,
  type TagTextEntryCreateDocument,
  type TagUpdateDocument,
  type TextEntryCreateDocument,
  tagCreateAttributesSchema,
  tagDocumentSchema,
  tagListDocumentSchema,
  tagListQuerySchema,
  tagSchema,
  tagTextEntrySchema,
  tagUpdateAttributesSchema,
  textEntryListQuerySchema,
  textEntryReusedListQuerySchema,
  textEntryReusedSchema,
  textEntrySchema,
  userDocumentSchema,
  userSchema,
} from '../src/index';
import {failures, parsed} from './support';

const ts = '2024-01-01T12:34:56.123456';
const user = {
  type: 'User',
  id: '1',
  attributes: {username: 'dan', is_staff: false, date_updated: ts},
};
const tag = {
  type: 'Tag',
  id: '2',
  attributes: {
    name: 'postgres',
    date_created: '2024-01-01T12:34:56',
    date_last_used: null,
    date_updated: ts,
    entry_count: 1,
    order: 0,
    is_deleted: false,
  },
  relationships: {user: {data: {type: 'User', id: '1'}}},
};
const links = {
  first: 'http://localhost/api/v1/tags?page%5Bnumber%5D=1',
  last: 'http://localhost/api/v1/tags?page%5Bnumber%5D=2',
  next: 'http://localhost/api/v1/tags?page%5Bnumber%5D=2',
  prev: null,
};
const meta = {pagination: {page: 1, pages: 2, count: 3}};

/** Parses, losing nothing. */
function roundTrips(schema: z.ZodType, document: unknown) {
  expect(parsed(schema, document)).toEqual(document as never);
}

describe('response documents', () => {
  test('parse as rendered, members and all', () => {
    roundTrips(userDocumentSchema, {data: user});
    roundTrips(tagDocumentSchema, {data: tag, included: [user]});
    roundTrips(tagListDocumentSchema, {
      links,
      meta,
      data: [tag],
      included: [user],
    });
    roundTrips(tagListDocumentSchema, {links, meta, data: []});
    roundTrips(adminAuditLogListDocumentSchema, {
      links,
      meta,
      data: [
        {
          type: 'AdminAuditLogEntry',
          id: '1',
          attributes: {
            created: ts,
            action: 'deactivate_user',
            actor_id: null,
            actor_username: 'staff',
            target_user_id: '3',
            target_username: 'alice',
          },
        },
      ],
    });
  });

  test('drop what the contract does not know, so parsing shows it', () => {
    const extra = {...tag, attributes: {...tag.attributes, secret: 1}};
    expect(parsed(tagSchema, extra)).toEqual(tag as never);
    expect(parsed(tagSchema, extra)).not.toEqual(extra as never);
  });

  test('refuse what the API never renders', () => {
    expect(failures(tagDocumentSchema, {data: tag, included: []})).toHaveLength(
      1
    );
    expect(
      failures(tagListDocumentSchema, {
        links: {...links, first: 'not a url'},
        meta,
        data: [],
      })
    ).toHaveLength(1);
    expect(failures(userSchema, {...user, id: 1})).toHaveLength(1);
    expect(
      failures(tagSchema, {
        ...tag,
        attributes: {...tag.attributes, date_updated: '2024-01-01'},
      })
    ).toHaveLength(1);
    expect(
      failures(tagSchema, {...tag, relationships: {user: {data: null}}})
    ).toHaveLength(1);
    expect(
      failures(userDocumentSchema, {data: user, included: [tag]})
    ).toHaveLength(1);
  });

  test('included resources are told apart by type', () => {
    const included = parsed(includedResourceSchema, tag);
    expect(included.type).toBe('Tag');
    expect(
      failures(includedResourceSchema, {...tag, type: 'Nope'})
    ).toHaveLength(1);
  });

  test('errors and empty bodies', () => {
    roundTrips(errorDocumentSchema, {errors: []});
    roundTrips(errorDocumentSchema, {
      errors: [
        {
          detail: 'Not found.',
          status: '404',
          code: 'not_found',
        },
        {
          detail: 'This field is required.',
          status: '400',
          source: {pointer: '/data/attributes/name'},
          code: 'required',
        },
      ],
    });
    expect(parsed(emptyObjectSchema, {})).toEqual({});
    expect(failures(emptyObjectSchema, {a: 1})).toHaveLength(1);
  });
});

describe('relationships', () => {
  const shapes: Array<[string, z.ZodObject]> = [
    ['Tag', tagSchema],
    ['TextEntry', textEntrySchema],
    ['TagTextEntryThroughModel', tagTextEntrySchema],
    ['TextEntryReused', textEntryReusedSchema],
  ];

  test.each(shapes)("%s renders the graph's relationships", (type, schema) => {
    const relationships = (schema.shape['relationships'] as z.ZodObject).shape;
    const graph = RELATIONSHIPS[type as keyof typeof RELATIONSHIPS];
    expect(Object.keys(relationships)).toEqual(Object.keys(graph));
  });

  test('users render none', () => {
    expect(Object.keys(RELATIONSHIPS.User)).toEqual([]);
    expect(userSchema.shape).not.toHaveProperty('relationships');
  });

  test('default includes are valid include paths', () => {
    for (const [type, paths] of Object.entries(DEFAULT_INCLUDES)) {
      expect(
        parsed(includeSchema(RELATIONSHIPS, type), paths.join(',')).length
      ).toBe(paths.length);
    }
  });
});

describe('request fields', () => {
  test('tags: a name of at most 24 characters', () => {
    expect(parsed(tagCreateAttributesSchema, {name: ' x '})).toEqual({
      name: 'x',
    });
    expect(failures(tagCreateAttributesSchema, {name: 'x'.repeat(25)})).toEqual(
      [
        {
          message: 'Ensure this field has no more than 24 characters.',
          path: ['name'],
          code: 'max_length',
        },
      ]
    );
    expect(parsed(tagUpdateAttributesSchema, {})).toEqual({});
  });

  test('admin: only is_active, the first other attribute refused', () => {
    expect(parsed(adminUserUpdateAttributesSchema, {is_active: 'no'})).toEqual({
      is_active: false,
    });
    expect(
      failures(adminUserUpdateAttributesSchema, {
        is_active: 'x',
        2: 1,
        email: 'x',
      })
    ).toEqual([
      {
        message: 'This field cannot be changed.',
        path: ['2'],
        code: 'read_only',
      },
    ]);
    expect(
      failures(adminUserUpdateAttributesSchema, JSON.parse('{"__proto__": 1}'))
    ).toHaveLength(1);
    expect(
      failures(adminUserUpdateAttributesSchema, {is_active: null})[0]?.message
    ).toBe('Must be a valid boolean.');
  });

  test('admin: attributes that are not an object fail instead of throwing', () => {
    for (const value of [null, undefined, [], 'is_active', 5]) {
      expect(adminUserUpdateAttributesSchema.safeParse(value).success).toBe(
        false
      );
    }
  });

  test('logins: a code', () => {
    expect(
      parsed(loginAttributesSchema, {code: ' c ', clientType: 'web'})
    ).toEqual({code: 'c'});
  });
});

describe('collection queries', () => {
  test('tags', () => {
    expect(
      parsed(tagListQuerySchema, [
        ['filter[user.username]', 'dan'],
        ['filter[date_updated.gt]', '2024-01-01'],
        ['filter[search]', 'ignored'],
        ['sort', '-order'],
      ])
    ).toEqual({
      filters: [
        {name: 'user__username', value: 'dan'},
        {name: 'date_updated__gt', value: '2024-01-01T00:00:00.000000'},
      ],
      search: null,
      sort: [{field: 'order', descending: true}],
      page: 1,
      pageSize: 50,
      include: null,
    });
  });

  test('entries search, and filter by tag', () => {
    expect(
      parsed(textEntryListQuerySchema, [
        ['filter[search]', 'term'],
        ['filter[tags.id]', '3'],
        ['filter[is_deleted]', 'false'],
      ])
    ).toEqual(
      expect.objectContaining({
        search: 'term',
        filters: [
          {name: 'tags__id', value: 3},
          {name: 'is_deleted', value: false},
        ],
      })
    );
  });

  test('entry reuses have no filters', () => {
    expect(
      failures(textEntryReusedListQuerySchema, [['filter[text_entry]', '1']])[0]
        ?.message
    ).toBe('invalid filter[text_entry]');
  });

  test('admin users: every sort field; include refused', () => {
    for (const field of ADMIN_USER_SORT_FIELDS) {
      expect(parsed(adminUserListQuerySchema, [['sort', field]]).sort).toEqual([
        {field, descending: false},
      ]);
    }
    expect(
      failures(adminUserListQuerySchema, [['include', 'x']])[0]?.message
    ).toBe('include is not supported here.');
  });

  test('the audit log: no sort, no search', () => {
    expect(
      failures(adminAuditLogListQuerySchema, [['sort', 'created']])[0]?.message
    ).toBe('invalid sort parameter: created');
    expect(
      failures(adminAuditLogListQuerySchema, [['filter[search]', '']])[0]
        ?.message
    ).toBe('filter[search] is not supported here.');
  });
});

describe('types', () => {
  test('describe documents as clients write and read them', () => {
    const create: TagCreateDocument = {
      data: {type: 'Tag', attributes: {name: 'x'}},
    };
    const update: TagUpdateDocument = {
      data: {type: 'Tag', id: '1', attributes: {is_deleted: true}},
    };
    const entry: TextEntryCreateDocument = {
      data: {type: 'TextEntry', attributes: {subject: 's', body: 'b'}},
    };
    const junction: TagTextEntryCreateDocument = {
      data: {
        type: 'TagTextEntryThroughModel',
        relationships: {
          tag: {data: {type: 'Tag', id: '1'}},
          text_entry: {data: {type: 'TextEntry', id: '2'}},
        },
      },
    };
    const admin: AdminUserUpdateDocument = {
      data: {type: 'AdminUser', id: '1', attributes: {is_active: false}},
    };
    const login: GithubLoginDocument = {
      data: {type: 'GithubLogin', attributes: {code: 'c'}},
    };
    const read: TagDocument = {data: tag as TagDocument['data']};
    const log: AdminAuditLogListDocument['data'][number]['attributes']['action'] =
      'activate_user';
    expect([
      create,
      update,
      entry,
      junction,
      admin,
      login,
      read,
      log,
    ]).toHaveLength(8);
  });
});
