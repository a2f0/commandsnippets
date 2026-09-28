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
  emptyObjectSchema,
  errorDocumentSchema,
  type TagTextEntryCreateDocument,
  type TagUpdateDocument,
  type TextEntryCreateDocument,
  type TextEntryUpdateDocument,
  tagDocumentSchema,
  tagListDocumentSchema,
  tagTextEntryDocumentSchema,
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
import type {z} from 'zod';

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
function expectContract(schema: z.ZodType, body: unknown) {
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
  schema?: z.ZodType;
  /** The request document, sent as JSON:API; otherwise `{}` (not JSON:API). */
  body?: unknown;
}

/** Send `exchange`'s request and check the response against it. */
async function check({method, url, status, schema, body}: Exchange) {
  const init: RequestInit = {method};
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = {'Content-Type': 'application/vnd.api+json'};
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
    handler: `GET ${API}/user/`,
    method: 'GET',
    url: `${API}/user/`,
    status: 200,
    schema: userDocumentSchema,
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
  },
  {
    handler: `PATCH ${API}/admin/users/:id`,
    method: 'PATCH',
    url: `${API}/admin/users/99`,
    status: 404,
    schema: errorDocumentSchema,
  },
  {
    // Not empty: the PATCH above logged a deactivation.
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
  },
  {
    handler: `POST ${API}/tags/reorder`,
    method: 'POST',
    url: `${API}/tags/reorder`,
    status: 200,
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
    // Entry 1 is gone now.
    handler: `DELETE ${API}/entries/:id`,
    method: 'DELETE',
    url: `${API}/entries/1`,
    status: 404,
    schema: errorDocumentSchema,
  },
  {
    handler: `DELETE ${API}/tags_entries/:id`,
    method: 'DELETE',
    url: `${API}/tags_entries/1`,
    status: 204,
  },
  {
    // Junction 1 is gone now.
    handler: `DELETE ${API}/tags_entries/:id`,
    method: 'DELETE',
    url: `${API}/tags_entries/1`,
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
    for (const path of ['/tags/reorder', '/tags_entries/reorder']) {
      await check({
        handler: '',
        method: 'POST',
        url: `${API}${path}`,
        status: 200,
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
