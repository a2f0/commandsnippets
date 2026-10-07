/**
 * The mocked API against the contract: every response the E2E handlers
 * (src/msw/handlers.ts), the unit tests' server (__tests__/util/msw.ts) and
 * the fixtures in test/mocks/ serve parses with api-shared's schema for its
 * endpoint, and loses nothing in parsing (no member the schema does not
 * know). A mock that drifts from the API fails here, not in a test that
 * happens to read it.
 */
import {
  adminAuditLogListDocumentSchema,
  adminUserDocumentSchema,
  adminUserListDocumentSchema,
  backupSchema,
  CURSOR_START,
  DATA_VERSION_HEADER,
  dataOwnerDocumentSchema,
  dataVersionDocumentSchema,
  dataVersionListDocumentSchema,
  EXPECTED_USER_HEADER,
  emptyObjectSchema,
  errorDocumentSchema,
  restoreResultSchema,
  type TagTextEntryCreateDocument,
  type TagUpdateDocument,
  type TextEntryCreateDocument,
  type TextEntryUpdateDocument,
  tagCursorListDocumentSchema,
  tagDocumentSchema,
  tagListDocumentSchema,
  tagTextEntryCursorListDocumentSchema,
  tagTextEntryDocumentSchema,
  tagTextEntryListDocumentSchema,
  textEntryCursorListDocumentSchema,
  textEntryDocumentSchema,
  textEntryListDocumentSchema,
  userDocumentSchema,
} from '@commandsnippets/api-shared';
import {setupServer} from 'msw/node';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type * as z from 'zod/mini';

import {
  handlers,
  resetMSWState,
  setRuntimeEntriesOverride,
} from '../../../src/msw/handlers';
import {entriesResponse} from '../../../test/mocks/entries/entriesResponse';
import {manyEntriesResponse} from '../../../test/mocks/entries/manyEntriesResponse';
import {tagsResponse} from '../../../test/mocks/tags/tagsResponse';
import {server as unitServer} from '../../util/msw';

const HOST = 'http://localhost:9001';
const API = `${HOST}/api/v1`;

/** `body` parses with `schema`, and parsing drops nothing from it. */
function expectContract(schema: z.ZodMiniType, body: unknown) {
  const result = schema.safeParse(body);
  expect(result.error?.issues ?? []).toEqual([]);
  expect(result.data).toEqual(body);
}

interface Exchange {
  /** The handler that answers (`info.header`: method and path pattern). */
  handler: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  status: number;
  /** The response document's schema; none for an empty body. */
  schema?: z.ZodMiniType;
  /** The request document, sent as JSON:API; otherwise `{}` (not JSON:API). */
  body?: unknown;
  headers?: Record<string, string>;
  /**
   * The data version a write names (`X-Data-Version`), as the app's name the
   * one their copy is of: the first by default; `null` for none.
   */
  version?: number | null;
}

/** Send `exchange`'s request and check the response against it. */
async function check({
  method,
  url,
  status,
  schema,
  body,
  headers: given,
  version = 1,
}: Exchange) {
  const headers = {
    ...(method === 'GET' || version === null
      ? {}
      : {[DATA_VERSION_HEADER]: String(version)}),
    ...given,
  };
  const init: RequestInit = {method, headers: {...headers}};
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = {...headers, 'Content-Type': 'application/vnd.api+json'};
  } else if (method !== 'GET' && method !== 'DELETE') {
    init.body = '{}';
  }
  const response = await fetch(url, init);
  expect(response.status).toBe(status);
  const text = await response.text();
  if (schema === undefined) {
    expect(text).toBe('');
  } else {
    expectContract(schema, JSON.parse(text));
  }
}

/** A `POST /tags_entries` document: tag `entryId` with `tagId`. */
const reorderDocument = (
  type: 'Tag' | 'TagTextEntryThroughModel',
  top: string,
  bottom: string
) => ({data: {type, attributes: {top, bottom}}});

const tagEntryDocument = (
  tagId: string,
  entryId: string
): TagTextEntryCreateDocument => ({
  data: {
    type: 'TagTextEntryThroughModel',
    relationships: {
      tag: {data: {type: 'Tag', id: tagId}},
      text_entry: {data: {type: 'TextEntry', id: entryId}},
    },
  },
});

// In the order they run: the handlers keep state (resetMSWState).
const exchanges: Exchange[] = [
  {
    handler: `GET ${API}/users/:username`,
    method: 'GET',
    url: `${API}/users/test`,
    status: 200,
    schema: dataOwnerDocumentSchema,
  },
  {
    handler: `GET ${API}/users/:username/tags`,
    method: 'GET',
    url: `${API}/users/test/tags`,
    status: 200,
    schema: tagListDocumentSchema,
  },
  {
    handler: `GET ${API}/users/:username/entries`,
    method: 'GET',
    url: `${API}/users/test/entries`,
    status: 200,
    schema: textEntryListDocumentSchema,
  },
  {
    handler: `GET ${API}/users/:username/tags_entries`,
    method: 'GET',
    url: `${API}/users/test/tags_entries`,
    status: 200,
    schema: tagTextEntryListDocumentSchema,
  },
  {
    handler: `GET ${API}/user/`,
    method: 'GET',
    url: `${API}/user/`,
    status: 200,
    schema: userDocumentSchema,
  },
  {
    handler: `GET ${API}/user/backup`,
    method: 'GET',
    url: `${API}/user/backup`,
    status: 200,
    schema: backupSchema,
  },
  {
    handler: `GET ${API}/admin/users`,
    method: 'GET',
    url: `${API}/admin/users?page%5Bnumber%5D=1&filter%5Bis_active%5D=true`,
    status: 200,
    schema: adminUserListDocumentSchema,
  },
  {
    handler: `PATCH ${API}/admin/users/:id`,
    method: 'PATCH',
    url: `${API}/admin/users/7`,
    status: 200,
    schema: adminUserDocumentSchema,
    body: {data: {type: 'AdminUser', id: '7', attributes: {is_active: false}}},
  },
  {
    handler: `PATCH ${API}/admin/users/:id`,
    method: 'PATCH',
    url: `${API}/admin/users/7`,
    status: 200,
    schema: adminUserDocumentSchema,
    body: {
      data: {
        type: 'AdminUser',
        id: '7',
        attributes: {marked_for_deletion: true},
      },
    },
  },
  {
    // A marked account stays deactivated.
    handler: `PATCH ${API}/admin/users/:id`,
    method: 'PATCH',
    url: `${API}/admin/users/7`,
    status: 400,
    schema: errorDocumentSchema,
    body: {data: {type: 'AdminUser', id: '7', attributes: {is_active: true}}},
  },
  {
    handler: `PATCH ${API}/admin/users/:id`,
    method: 'PATCH',
    url: `${API}/admin/users/99`,
    status: 404,
    schema: errorDocumentSchema,
  },
  {
    handler: `GET ${API}/admin/users`,
    method: 'GET',
    url: `${API}/admin/users?filter%5Busername%5D=alice`,
    status: 200,
    schema: adminUserListDocumentSchema,
  },
  // Alice's data, read-only, as the sync reads it.
  {
    handler: `GET ${API}/admin/users/:id/tags`,
    method: 'GET',
    url: `${API}/admin/users/7/tags?page%5Bafter%5D=${CURSOR_START}`,
    status: 200,
    schema: tagCursorListDocumentSchema,
  },
  {
    handler: `GET ${API}/admin/users/:id/tags`,
    method: 'GET',
    url: `${API}/admin/users/99/tags?page%5Bafter%5D=${CURSOR_START}`,
    status: 404,
    schema: errorDocumentSchema,
  },
  {
    handler: `GET ${API}/admin/users/:id/entries`,
    method: 'GET',
    url: `${API}/admin/users/7/entries?page%5Bafter%5D=${CURSOR_START}&include=text_entry_to_tag`,
    status: 200,
    schema: textEntryCursorListDocumentSchema,
  },
  {
    handler: `GET ${API}/admin/users/:id/tags_entries`,
    method: 'GET',
    url: `${API}/admin/users/7/tags_entries?filter%5Btag.id%5D=70&page%5Bafter%5D=${CURSOR_START}&include=text_entry,text_entry.text_entry_to_tag`,
    status: 200,
    schema: tagTextEntryCursorListDocumentSchema,
  },
  {
    handler: `GET ${API}/admin/users/:id/tags_entries`,
    method: 'GET',
    url: `${API}/admin/users/1/tags_entries?sort=-date_updated&page%5Bsize%5D=1`,
    status: 200,
    schema: tagTextEntryListDocumentSchema,
  },
  {
    // Not empty: the PATCHes above logged a deactivation and a mark.
    handler: `GET ${API}/admin/audit_log`,
    method: 'GET',
    url: `${API}/admin/audit_log?page%5Bnumber%5D=1`,
    status: 200,
    schema: adminAuditLogListDocumentSchema,
  },
  {
    handler: `GET ${API}/tags`,
    method: 'GET',
    url: `${API}/tags?page%5Bnumber%5D=1&filter%5Buser.username%5D=test`,
    status: 200,
    schema: tagListDocumentSchema,
  },
  {
    handler: `POST ${API}/tags`,
    method: 'POST',
    url: `${API}/tags`,
    status: 201,
    schema: tagDocumentSchema,
    body: {data: {type: 'Tag', attributes: {name: 'new-tag'}}},
  },
  {
    // A tag of a name the user has is that tag.
    handler: `POST ${API}/tags`,
    method: 'POST',
    url: `${API}/tags`,
    status: 201,
    schema: tagDocumentSchema,
    body: {data: {type: 'Tag', attributes: {name: 'test-tag-1'}}},
  },
  {
    handler: `POST ${API}/tags`,
    method: 'POST',
    url: `${API}/tags`,
    status: 400,
    schema: errorDocumentSchema,
    body: {data: {type: 'Tag', attributes: {name: ''}}},
  },
  {
    // A write naming no data version.
    handler: `POST ${API}/tags`,
    method: 'POST',
    url: `${API}/tags`,
    status: 400,
    schema: errorDocumentSchema,
    body: {data: {type: 'Tag', attributes: {name: 'unversioned'}}},
    version: null,
  },
  // One tag or entry (to put back what a refused write changed).
  {
    handler: `GET ${API}/tags/:id`,
    method: 'GET',
    url: `${API}/tags/1`,
    status: 200,
    schema: tagDocumentSchema,
  },
  {
    handler: `GET ${API}/tags/:id`,
    method: 'GET',
    url: `${API}/tags/99`,
    status: 404,
    schema: errorDocumentSchema,
  },
  {
    handler: `GET ${API}/entries/:id`,
    method: 'GET',
    url: `${API}/entries/1`,
    status: 200,
    schema: textEntryDocumentSchema,
  },
  {
    handler: `GET ${API}/entries/:id`,
    method: 'GET',
    url: `${API}/entries/99`,
    status: 404,
    schema: errorDocumentSchema,
  },
  {
    handler: `PATCH ${API}/tags/:id`,
    method: 'PATCH',
    url: `${API}/tags/2`,
    status: 200,
    schema: tagDocumentSchema,
    body: {
      data: {type: 'Tag', id: '2', attributes: {name: 'renamed'}},
    } satisfies TagUpdateDocument,
  },
  {
    // Another of the user's tags has that name.
    handler: `PATCH ${API}/tags/:id`,
    method: 'PATCH',
    url: `${API}/tags/2`,
    status: 400,
    schema: errorDocumentSchema,
    body: {
      data: {type: 'Tag', id: '2', attributes: {name: 'test-tag-1'}},
    } satisfies TagUpdateDocument,
  },
  {
    handler: `PATCH ${API}/tags/:id`,
    method: 'PATCH',
    url: `${API}/tags/99`,
    status: 404,
    schema: errorDocumentSchema,
    body: {
      data: {type: 'Tag', id: '99', attributes: {name: 'renamed'}},
    } satisfies TagUpdateDocument,
  },
  {
    handler: `GET ${API}/entries`,
    method: 'GET',
    url: `${API}/entries?page%5Bnumber%5D=1`,
    status: 200,
    schema: textEntryListDocumentSchema,
  },
  {
    handler: `POST ${API}/entries`,
    method: 'POST',
    url: `${API}/entries`,
    status: 201,
    schema: textEntryDocumentSchema,
    body: {
      data: {type: 'TextEntry', attributes: {subject: 'new', body: 'new body'}},
    } satisfies TextEntryCreateDocument,
  },
  {
    handler: `POST ${API}/entries`,
    method: 'POST',
    url: `${API}/entries`,
    status: 400,
    schema: errorDocumentSchema,
    body: {data: {type: 'TextEntry', attributes: {subject: 'new'}}},
  },
  {
    handler: `PATCH ${API}/entries/:id`,
    method: 'PATCH',
    url: `${API}/entries/1`,
    status: 200,
    schema: textEntryDocumentSchema,
    body: {
      data: {
        type: 'TextEntry',
        id: '1',
        attributes: {subject: 'edited', body: 'edited body'},
      },
    } satisfies TextEntryUpdateDocument,
  },
  {
    handler: `PATCH ${API}/entries/:id`,
    method: 'PATCH',
    url: `${API}/entries/99`,
    status: 404,
    schema: errorDocumentSchema,
    body: {
      data: {type: 'TextEntry', id: '99', attributes: {subject: 'x'}},
    } satisfies TextEntryUpdateDocument,
  },
  {
    handler: `POST ${API}/tags_entries`,
    method: 'POST',
    url: `${API}/tags_entries`,
    status: 201,
    schema: tagTextEntryDocumentSchema,
    body: tagEntryDocument('2', '1'),
  },
  {
    // Get-or-create: the same junction again.
    handler: `POST ${API}/tags_entries`,
    method: 'POST',
    url: `${API}/tags_entries`,
    status: 201,
    schema: tagTextEntryDocumentSchema,
    body: tagEntryDocument('2', '1'),
  },
  {
    handler: `POST ${API}/tags_entries`,
    method: 'POST',
    url: `${API}/tags_entries`,
    status: 400,
    schema: errorDocumentSchema,
    body: tagEntryDocument('99', '1'),
  },
  {
    handler: `POST ${API}/tags_entries/reorder`,
    method: 'POST',
    url: `${API}/tags_entries/reorder`,
    status: 200,
    body: reorderDocument('TagTextEntryThroughModel', '2', '1'),
  },
  {
    handler: `POST ${API}/tags_entries/reorder`,
    method: 'POST',
    url: `${API}/tags_entries/reorder`,
    status: 400,
    schema: errorDocumentSchema,
    body: reorderDocument('TagTextEntryThroughModel', '99', '1'),
  },
  {
    handler: `POST ${API}/tags/reorder`,
    method: 'POST',
    url: `${API}/tags/reorder`,
    status: 200,
    body: reorderDocument('Tag', '4', '2'),
  },
  {
    handler: `DELETE ${API}/tags/:id`,
    method: 'DELETE',
    url: `${API}/tags/1`,
    status: 200,
    schema: tagDocumentSchema,
  },
  {
    handler: `DELETE ${API}/tags/:id`,
    method: 'DELETE',
    url: `${API}/tags/99`,
    status: 404,
    schema: errorDocumentSchema,
  },
  {
    handler: `DELETE ${API}/entries/:id`,
    method: 'DELETE',
    url: `${API}/entries/1`,
    status: 200,
    schema: textEntryDocumentSchema,
  },
  {
    // Entry 1 is deleted, and kept (soft deletes): deleting it again answers
    // it again.
    handler: `DELETE ${API}/entries/:id`,
    method: 'DELETE',
    url: `${API}/entries/1`,
    status: 200,
    schema: textEntryDocumentSchema,
  },
  {
    handler: `DELETE ${API}/entries/:id`,
    method: 'DELETE',
    url: `${API}/entries/99`,
    status: 404,
    schema: errorDocumentSchema,
  },
  {
    // The junction, deleted.
    handler: `DELETE ${API}/tags_entries/:id`,
    method: 'DELETE',
    url: `${API}/tags_entries/1`,
    status: 200,
    schema: tagTextEntryDocumentSchema,
  },
  {
    // Junction 1 is untagged already: answered alike (a retried untag).
    handler: `DELETE ${API}/tags_entries/:id`,
    method: 'DELETE',
    url: `${API}/tags_entries/1`,
    status: 200,
    schema: tagTextEntryDocumentSchema,
  },
  {
    handler: `DELETE ${API}/tags_entries/:id`,
    method: 'DELETE',
    url: `${API}/tags_entries/999`,
    status: 404,
    schema: errorDocumentSchema,
  },
  // The sync's reads: keyset pages, and the junctions (deleted ones too).
  {
    handler: `GET ${API}/tags`,
    method: 'GET',
    url: `${API}/tags?page%5Bafter%5D=${CURSOR_START}&page%5Bsize%5D=2`,
    status: 200,
    schema: tagCursorListDocumentSchema,
  },
  {
    handler: `GET ${API}/tags`,
    method: 'GET',
    url: `${API}/tags?page%5Bafter%5D=nope`,
    status: 400,
    schema: errorDocumentSchema,
  },
  {
    handler: `GET ${API}/entries`,
    method: 'GET',
    url: `${API}/entries?page%5Bafter%5D=${CURSOR_START}&include=text_entry_to_tag`,
    status: 200,
    schema: textEntryCursorListDocumentSchema,
  },
  {
    handler: `GET ${API}/entries`,
    method: 'GET',
    url: `${API}/entries?page%5Bafter%5D=${CURSOR_START}&page%5Bnumber%5D=1`,
    status: 400,
    schema: errorDocumentSchema,
  },
  {
    handler: `GET ${API}/tags_entries`,
    method: 'GET',
    url: `${API}/tags_entries?page%5Bafter%5D=${CURSOR_START}&filter%5Btag.id%5D=1&include=text_entry%2Ctext_entry.text_entry_to_tag`,
    status: 200,
    schema: tagTextEntryCursorListDocumentSchema,
  },
  {
    handler: `GET ${API}/tags_entries`,
    method: 'GET',
    url: `${API}/tags_entries?sort=-date_updated&page%5Bsize%5D=1`,
    status: 200,
    schema: tagTextEntryListDocumentSchema,
  },
  {
    handler: `GET ${API}/tags_entries`,
    method: 'GET',
    url: `${API}/tags_entries?page%5Bnumber%5D=9`,
    status: 404,
    schema: errorDocumentSchema,
  },
  {
    handler: `POST ${HOST}/api-token-deauth/`,
    method: 'POST',
    url: `${HOST}/api-token-deauth/`,
    status: 200,
    schema: emptyObjectSchema,
  },
  {
    handler: `POST ${API}/user/restore`,
    method: 'POST',
    url: `${API}/user/restore`,
    status: 400,
    schema: errorDocumentSchema,
    body: {format: 'something-else'},
  },
  {
    // Last: it replaces the mock's data.
    handler: `POST ${API}/user/restore`,
    method: 'POST',
    url: `${API}/user/restore`,
    status: 200,
    schema: restoreResultSchema,
    body: {
      format: 'commandsnippets-backup',
      version: 1,
      date_exported: '2026-10-01T00:00:00.000000',
      user: {id: '9', username: 'elsewhere'},
      tags: [
        {
          id: '5',
          name: 'restored',
          order: 0,
          is_public: false,
          date_created: '2026-10-01T00:00:00.000000',
          date_updated: '2026-10-01T00:00:00.000000',
        },
      ],
      entries: [
        {
          id: '6',
          subject: 'restored',
          body: 'body',
          is_public: false,
          date_created: '2026-10-01T00:00:00.000000',
          date_updated: '2026-10-01T00:00:00.000000',
        },
      ],
      tags_entries: [
        {
          id: '7',
          tag_id: '5',
          text_entry_id: '6',
          order: 0,
          date_created: '2026-10-01T00:00:00.000000',
          date_updated: '2026-10-01T00:00:00.000000',
        },
      ],
      entry_reuses: [],
    },
  },
  {
    handler: `GET ${API}/user/data_versions`,
    method: 'GET',
    url: `${API}/user/data_versions`,
    status: 200,
    schema: dataVersionListDocumentSchema,
  },
  {
    handler: `GET ${API}/user/backup`,
    method: 'GET',
    url: `${API}/user/backup?version=1`,
    status: 200,
    schema: backupSchema,
  },
  {
    handler: `GET ${API}/user/backup`,
    method: 'GET',
    url: `${API}/user/backup?version=9`,
    status: 404,
    schema: errorDocumentSchema,
  },
  {
    handler: `DELETE ${API}/user/data_versions/:version`,
    method: 'DELETE',
    url: `${API}/user/data_versions/2`,
    status: 400,
    schema: errorDocumentSchema,
  },
  {
    handler: `POST ${API}/user/data_versions/:version/activate`,
    method: 'POST',
    url: `${API}/user/data_versions/1/activate`,
    status: 200,
    schema: dataVersionDocumentSchema,
  },
  {
    handler: `POST ${API}/user/data_versions/:version/activate`,
    method: 'POST',
    url: `${API}/user/data_versions/9/activate`,
    status: 404,
    schema: errorDocumentSchema,
  },
  {
    handler: `DELETE ${API}/user/data_versions/:version`,
    method: 'DELETE',
    url: `${API}/user/data_versions/9`,
    status: 404,
    schema: errorDocumentSchema,
  },
  {
    // A read naming another data version than the active one.
    handler: `/.+/ ${API}/*`,
    method: 'GET',
    url: `${API}/tags`,
    headers: {'X-Data-Version': '7'},
    status: 409,
    schema: errorDocumentSchema,
  },
  {
    // A write naming another user than the signed-in one.
    handler: `/.+/ ${API}/*`,
    method: 'POST',
    url: `${API}/tags`,
    headers: {[EXPECTED_USER_HEADER]: 'someone-else'},
    status: 409,
    schema: errorDocumentSchema,
    body: {data: {type: 'Tag', attributes: {name: 'theirs'}}},
  },
];

/** Handlers that are not the API's (the test harness's readiness probe). */
const notTheApi = new Set([`GET ${API}/health`]);

describe('the E2E handlers (src/msw/handlers.ts)', () => {
  const server = setupServer(...handlers);

  beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
  afterAll(() => server.close());
  beforeEach(() => {
    resetMSWState();
    // The handlers announce each request.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    return () => vi.restoreAllMocks();
  });

  it('answer every request as the API would', async () => {
    for (const exchange of exchanges) {
      await check(exchange);
    }
  });

  it('are all checked here', () => {
    const local = handlers
      .map(handler => handler.info.header)
      .filter(header => header.includes(`${HOST}/`));
    const checked = new Set(exchanges.map(({handler}) => handler));
    expect(local.filter(header => !notTheApi.has(header)).sort()).toEqual(
      [...checked].sort()
    );
  });

  it('answer every API base URL alike', async () => {
    for (const base of [
      'https://api-staging.commandsnippets.com',
      'https://api.commandsnippets.com',
    ]) {
      for (const exchange of exchanges.filter(({status}) => status < 300)) {
        resetMSWState();
        await check({...exchange, url: exchange.url.replace(HOST, base)});
      }
    }
  });

  it('filter a runtime override of the entries by date', async () => {
    setRuntimeEntriesOverride(manyEntriesResponse);
    await check({
      handler: `GET ${API}/entries`,
      method: 'GET',
      url: `${API}/entries?filter%5Bdate_updated.gt%5D=2024-12-20T00%3A00%3A00`,
      status: 200,
      schema: textEntryListDocumentSchema,
    });
    // Nothing newer: no entries, and only the user included.
    await check({
      handler: `GET ${API}/entries`,
      method: 'GET',
      url: `${API}/entries?filter%5Bdate_updated.gt%5D=2030-01-01T00%3A00%3A00`,
      status: 200,
      schema: textEntryListDocumentSchema,
    });
  });
});

describe("the unit tests' server (__tests__/util/msw.ts)", () => {
  beforeAll(() => unitServer.listen({onUnhandledRequest: 'error'}));
  afterAll(() => unitServer.close());

  it('answers every request as the API would', async () => {
    await check({
      handler: '',
      method: 'GET',
      url: `${API}/tags`,
      status: 200,
      schema: tagListDocumentSchema,
    });
    await check({
      handler: '',
      method: 'GET',
      url: `${API}/entries`,
      status: 200,
      schema: textEntryListDocumentSchema,
    });
    for (const [path, body] of [
      ['/tags/reorder', reorderDocument('Tag', '4', '2')],
      [
        '/tags_entries/reorder',
        reorderDocument('TagTextEntryThroughModel', '2', '1'),
      ],
    ] as const) {
      await check({
        handler: '',
        method: 'POST',
        url: `${API}${path}`,
        status: 200,
        body,
      });
    }
    await check({
      handler: '',
      method: 'POST',
      url: `${HOST}/api-token-deauth/`,
      status: 200,
      schema: emptyObjectSchema,
    });
  });
});

describe('the fixtures (test/mocks)', () => {
  it.each([
    ['tagsResponse', tagListDocumentSchema, tagsResponse],
    ['entriesResponse', textEntryListDocumentSchema, entriesResponse],
    ['manyEntriesResponse', textEntryListDocumentSchema, manyEntriesResponse],
  ])('%s is a list document', (_name, schema, fixture) => {
    expectContract(schema, fixture);
  });
});
