/**
 * The E2E handlers' writes, against backend-v2's behavior: what each answers
 * and how the mock state (counters, junctions, revisions) changes, as later
 * reads show it. contract.spec.ts checks the documents' shapes.
 */
import {
  type Backup,
  backupSchema,
  CLIENT_WRITE_ID_HEADER,
  CODES,
  CURSOR_START,
  cursorOf,
  DATA_VERSION_HEADER,
  dataVersionDocumentSchema,
  dataVersionListDocumentSchema,
  type IncludedResource,
  restoreResultSchema,
  type TagListDocument,
  type TagTextEntry,
  type TagTextEntryCreateDocument,
  type TagUpdateDocument,
  type TextEntryListDocument,
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
} from '@commandsnippets/api-shared';
import invariant from 'invariant';
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

import {
  handlers,
  resetMSWState,
  setRuntimeEntriesOverride,
} from '../../../src/msw/handlers';
import {manyEntriesResponse} from '../../../test/mocks/entries/manyEntriesResponse';

const API = 'http://localhost:9001/api/v1';
const JSON_API = {'Content-Type': 'application/vnd.api+json'};

const server = setupServer(...handlers);

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterAll(() => server.close());
/**
 * The data version the writes `send` makes name (`X-Data-Version`), as the
 * app's name the one their copy of the data is of: the first, until a
 * restore or a switch makes another active (or none, `undefined`).
 */
let named: number | undefined;

beforeEach(() => {
  resetMSWState();
  named = 1;
  // The handlers announce each request.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  return () => vi.restoreAllMocks();
});

async function send(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  headers: Record<string, string> = JSON_API
) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(method === 'GET' || named === undefined
        ? {}
        : {[DATA_VERSION_HEADER]: String(named)}),
      ...(body === undefined ? {} : headers),
    },
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  const text = await response.text();
  return {status: response.status, json: text === '' ? null : JSON.parse(text)};
}

const getTags = async (): Promise<TagListDocument> =>
  tagListDocumentSchema.parse((await send('GET', '/tags')).json);
const getEntries = async (): Promise<TextEntryListDocument> =>
  textEntryListDocumentSchema.parse((await send('GET', '/entries')).json);

const tagOf = (document: TagListDocument, id: string) => {
  const tag = document.data.find(candidate => candidate.id === id);
  invariant(tag, `tag ${id} is listed`);
  return tag;
};
const entryOf = (document: TextEntryListDocument, id: string) => {
  const entry = document.data.find(candidate => candidate.id === id);
  invariant(entry, `entry ${id} is listed`);
  return entry;
};
const junctionIds = (document: {included?: IncludedResource[] | undefined}) =>
  (document.included ?? [])
    .filter(resource => resource.type === 'TagTextEntryThroughModel')
    .map(({id}) => id);
const latest = (timestamps: string[]) => timestamps.sort().at(-1) ?? '';
const identifiers = (resources: IncludedResource[] = []) =>
  resources.map(({type, id}) => `${type}:${id}`);

const renameTag = (id: string, name: string): TagUpdateDocument => ({
  data: {type: 'Tag', id, attributes: {name}},
});
const editEntry = (
  id: string,
  attributes: NonNullable<TextEntryUpdateDocument['data']['attributes']>
): TextEntryUpdateDocument => ({data: {type: 'TextEntry', id, attributes}});
const tagEntry = (
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

/** An error document of one error. */
const oneError = (
  status: number,
  code: string,
  detail: string,
  pointer = '/data'
) => ({errors: [{detail, status: String(status), source: {pointer}, code}]});

describe('PATCH /tags/:id', () => {
  it('renames the tag with a new revision, which the tags then list', async () => {
    const before = await getTags();
    const {status, json} = await send(
      'PATCH',
      '/tags/2',
      renameTag('2', '  renamed  ')
    );
    expect(status).toBe(200);
    const {data, included} = tagDocumentSchema.parse(json);
    expect(data.attributes).toEqual({
      ...tagOf(before, '2').attributes,
      name: 'renamed',
      date_updated: data.attributes.date_updated,
    });
    expect(
      data.attributes.date_updated >
        latest(before.data.map(tag => tag.attributes.date_updated))
    ).toBe(true);
    expect(identifiers(included)).toEqual(['User:1']);
    expect(tagOf(await getTags(), '2')).toEqual(data);
  });

  it('(un)deletes the tag', async () => {
    const {json} = await send('PATCH', '/tags/2', {
      data: {type: 'Tag', id: '2', attributes: {is_deleted: 'true'}},
    });
    expect(tagDocumentSchema.parse(json).data.attributes.is_deleted).toBe(true);
    expect(tagOf(await getTags(), '2').attributes.is_deleted).toBe(true);
  });

  it('refuses the name of another of the user tags', async () => {
    const {status, json} = await send(
      'PATCH',
      '/tags/2',
      renameTag('2', 'test-tag-1')
    );
    expect(status).toBe(400);
    expect(json).toEqual(
      oneError(
        400,
        CODES.unique,
        'The fields name, user must make a unique set.'
      )
    );
    expect(tagOf(await getTags(), '2').attributes.name).toBe('test-tag-2');
  });

  it('keeps the name the tag has', async () => {
    const {status} = await send(
      'PATCH',
      '/tags/2',
      renameTag('2', 'test-tag-2')
    );
    expect(status).toBe(200);
  });

  it('reports every invalid attribute', async () => {
    const {status, json} = await send('PATCH', '/tags/2', {
      data: {
        type: 'Tag',
        id: '2',
        attributes: {name: 'x'.repeat(25), is_deleted: 'maybe'},
      },
    });
    expect(status).toBe(400);
    expect(json).toEqual({
      errors: [
        ...oneError(
          400,
          CODES.maxLength,
          'Ensure this field has no more than 24 characters.',
          '/data/attributes/name'
        ).errors,
        ...oneError(
          400,
          CODES.invalid,
          'Must be a valid boolean.',
          '/data/attributes/is_deleted'
        ).errors,
      ],
    });
  });

  it.each([
    [
      'an unknown tag',
      '/tags/99',
      renameTag('99', 'x'),
      JSON_API,
      oneError(404, CODES.notFound, 'No Tag matches the given query.'),
    ],
    [
      'a body that is not JSON',
      '/tags/2',
      renameTag('2', 'x'),
      {'Content-Type': 'text/plain'},
      oneError(
        415,
        CODES.unsupportedMediaType,
        'Unsupported media type "text/plain" in request.'
      ),
    ],
    [
      'another type',
      '/tags/2',
      {data: {type: 'TextEntry', id: '2', attributes: {}}},
      JSON_API,
      oneError(
        409,
        CODES.conflict,
        "The resource object's type (TextEntry) is not the type that constitute the collection represented by the endpoint (Tag)."
      ),
    ],
    [
      'another id',
      '/tags/2',
      renameTag('3', 'x'),
      JSON_API,
      oneError(
        409,
        CODES.conflict,
        "The resource object's id (3) does not match the endpoint's id (2)."
      ),
    ],
    [
      'no id',
      '/tags/2',
      {data: {type: 'Tag', attributes: {name: 'x'}}},
      JSON_API,
      oneError(
        400,
        CODES.parseError,
        "The resource identifier object must contain an 'id' member"
      ),
    ],
  ])(
    'answers %s as the API does',
    async (_name, path, body, headers, error) => {
      const {status, json} = await send('PATCH', path, body, headers);
      expect(json).toEqual(error);
      expect(status).toBe(Number(error.errors[0]?.status));
    }
  );
});

describe('POST /entries', () => {
  it('creates an untagged entry, which the entries then list', async () => {
    const before = await getEntries();
    const {status, json} = await send('POST', '/entries', {
      data: {type: 'TextEntry', attributes: {subject: ' new ', body: 'body'}},
    });
    expect(status).toBe(201);
    const {data, included} = textEntryDocumentSchema.parse(json);
    expect(data).toEqual({
      type: 'TextEntry',
      id: '4',
      attributes: {
        subject: 'new',
        body: 'body',
        date_updated: data.attributes.date_updated,
        date_created: data.attributes.date_created,
        is_public: false,
        reused_count: 0,
        is_deleted: false,
        tag_count: 0,
        client_id: null,
      },
      relationships: {
        user: {data: {type: 'User', id: '1'}},
        text_entry_to_tag: {data: [], meta: {count: 0}},
      },
    });
    expect(
      data.attributes.date_updated >
        latest(before.data.map(entry => entry.attributes.date_updated))
    ).toBe(true);
    expect(identifiers(included)).toEqual(['User:1']);
    expect(entryOf(await getEntries(), '4')).toEqual(data);
  });

  it('keeps a deleted entry, whose id no new entry gets', async () => {
    expect((await send('DELETE', '/entries/3')).status).toBe(200);
    const {json} = await send('POST', '/entries', {
      data: {type: 'TextEntry', attributes: {subject: 'new', body: 'body'}},
    });
    const {data} = textEntryDocumentSchema.parse(json);
    expect(data.id).toBe('4');
    expect(entryOf(await getEntries(), '3')?.attributes.is_deleted).toBe(true);
  });

  it('reports every invalid attribute', async () => {
    const {status, json} = await send('POST', '/entries', {
      data: {type: 'TextEntry', attributes: {subject: 7, body: null}},
    });
    expect(status).toBe(400);
    // A number is a string to DRF.
    expect(json).toEqual(
      oneError(
        400,
        CODES.null,
        'This field may not be null.',
        '/data/attributes/body'
      )
    );
    expect((await getEntries()).data).toHaveLength(3);
  });

  it('makes an entry once per client id, as the API does', async () => {
    const create = async () =>
      textEntryDocumentSchema.parse(
        (
          await send('POST', '/entries', {
            data: {
              type: 'TextEntry',
              attributes: {subject: 'once', body: 'b', client_id: 'local-e'},
            },
          })
        ).json
      ).data;
    const made = await create();
    expect(made.attributes.client_id).toBe('local-e');
    expect((await create()).id).toBe(made.id);
    expect((await getEntries()).data).toHaveLength(4);
  });
});

describe('POST /tags', () => {
  const create = async (name: string, clientId?: string) =>
    tagDocumentSchema.parse(
      (
        await send('POST', '/tags', {
          data: {
            type: 'Tag',
            attributes: {
              name,
              ...(clientId === undefined ? {} : {client_id: clientId}),
            },
          },
        })
      ).json
    ).data;

  it('makes a tag once per client id, whatever it is called by the retry', async () => {
    const made = await create('first', 'local-t');
    expect(made.attributes.client_id).toBe('local-t');
    await send('PATCH', `/tags/${made.id}`, renameTag(made.id, 'second'));
    const again = await create('first', 'local-t');
    expect(again.id).toBe(made.id);
    expect(again.attributes.name).toBe('second');
    expect((await getTags()).data).toHaveLength(5);
  });

  it('answers a retry with the tag of the name it answered with, renamed since', async () => {
    const tag = await create('test-tag-1', 'local-mine');
    expect(tag.id).toBe('1');
    await send('PATCH', '/tags/1', renameTag('1', 'moved'));
    const again = await create('test-tag-1', 'local-mine');
    expect(again.id).toBe('1');
    expect(again.attributes.name).toBe('moved');
    expect((await getTags()).data).toHaveLength(4);
  });
});

describe('POST /tags/reorder and /tags_entries/reorder', () => {
  const reorder = (
    path: string,
    type: 'Tag' | 'TagTextEntryThroughModel',
    top: string,
    bottom: string
  ) => send('POST', path, {data: {type, attributes: {top, bottom}}});
  const ranks = (rows: Array<{id: string; attributes: {order: number}}>) =>
    [...rows]
      .sort((a, b) => a.attributes.order - b.attributes.order)
      .map(({id}) => id);

  it('move a tag directly above another, the tags between shifting, each with a new revision', async () => {
    const before = await getTags();
    expect(ranks(before.data)).toEqual(['1', '2', '3', '4']);
    expect((await reorder('/tags/reorder', 'Tag', '4', '2')).status).toBe(200);
    const after = await getTags();
    expect(ranks(after.data)).toEqual(['1', '4', '2', '3']);
    // The rows whose rank changed get a new revision; the others keep theirs.
    const newest = latest(before.data.map(tag => tag.attributes.date_updated));
    for (const id of ['2', '3', '4']) {
      expect(tagOf(after, id).attributes.date_updated > newest).toBe(true);
    }
    expect(tagOf(after, '1')).toEqual(tagOf(before, '1'));

    // Downward too: 4 above 3.
    await reorder('/tags/reorder', 'Tag', '4', '3');
    expect(ranks((await getTags()).data)).toEqual(['1', '2', '4', '3']);
  });

  it('move an entry directly above another in a tag', async () => {
    const junctions = async () =>
      ((await getEntries()).included ?? []).filter(
        (resource): resource is TagTextEntry =>
          resource.type === 'TagTextEntryThroughModel'
      );
    // Entries 1 and 2 are in tag 1.
    expect(ranks(await junctions())).toEqual(['1', '2']);
    const response = await reorder(
      '/tags_entries/reorder',
      'TagTextEntryThroughModel',
      '2',
      '1'
    );
    expect(response.status).toBe(200);
    expect(ranks(await junctions())).toEqual(['2', '1']);
  });

  it('make a reorder the client names once, as the API does', async () => {
    const named = (top: string, bottom: string, writeId: string) =>
      send(
        'POST',
        '/tags/reorder',
        {data: {type: 'Tag', attributes: {top, bottom}}},
        {...JSON_API, [CLIENT_WRITE_ID_HEADER]: writeId}
      );
    await named('4', '2', 'move-1');
    await reorder('/tags/reorder', 'Tag', '2', '4');
    expect(ranks((await getTags()).data)).toEqual(['1', '2', '4', '3']);
    // Its retry: nothing moves.
    expect((await named('4', '2', 'move-1')).status).toBe(200);
    expect(ranks((await getTags()).data)).toEqual(['1', '2', '4', '3']);
  });

  it('refuses a row that does not exist (or a deleted junction)', async () => {
    const tagged = await reorder('/tags/reorder', 'Tag', '99', '1');
    expect(tagged.status).toBe(400);
    expect(tagged.json).toEqual(
      oneError(
        400,
        CODES.doesNotExist,
        'Invalid pk "99" - object does not exist.',
        '/data/attributes/top'
      )
    );
    expect((await send('DELETE', '/tags_entries/2')).status).toBe(200);
    const untagged = await reorder(
      '/tags_entries/reorder',
      'TagTextEntryThroughModel',
      '2',
      '1'
    );
    expect(untagged.status).toBe(400);
  });
});

describe('PATCH /entries/:id', () => {
  it('edits the entry with a new revision, which the entries then list', async () => {
    const before = await getEntries();
    const {status, json} = await send(
      'PATCH',
      '/entries/1',
      editEntry('1', {subject: ' edited ', body: 'edited body'})
    );
    expect(status).toBe(200);
    const {data, included} = textEntryDocumentSchema.parse(json);
    expect(data).toEqual({
      ...entryOf(before, '1'),
      attributes: {
        ...entryOf(before, '1').attributes,
        subject: 'edited',
        body: 'edited body',
        date_updated: data.attributes.date_updated,
      },
    });
    expect(
      data.attributes.date_updated >
        latest(before.data.map(entry => entry.attributes.date_updated))
    ).toBe(true);
    // Its junctions, their tags and its owner, in the API's order.
    expect(identifiers(included)).toEqual([
      'Tag:1',
      'TagTextEntryThroughModel:1',
      'User:1',
    ]);
    expect(entryOf(await getEntries(), '1')).toEqual(data);
  });

  it("advances the revisions of the entry's tags, and only theirs", async () => {
    const before = await getTags();
    await send('PATCH', '/entries/1', editEntry('1', {body: 'edited'}));
    const after = await getTags();
    // Entry 1 is in tag 1 only.
    expect(
      tagOf(after, '1').attributes.date_updated >
        latest(before.data.map(tag => tag.attributes.date_updated))
    ).toBe(true);
    for (const id of ['2', '3', '4']) {
      expect(tagOf(after, id)).toEqual(tagOf(before, id));
    }
  });

  it('leaves out the attributes not sent', async () => {
    const {json} = await send(
      'PATCH',
      '/entries/2',
      editEntry('2', {body: 'only the body'})
    );
    const {attributes} = textEntryDocumentSchema.parse(json).data;
    expect(attributes.subject).toBe('test-entry-2-subject');
    expect(attributes.body).toBe('only the body');
  });

  it('reports an invalid attribute', async () => {
    const {status, json} = await send('PATCH', '/entries/1', {
      data: {type: 'TextEntry', id: '1', attributes: {subject: '   '}},
    });
    expect(status).toBe(400);
    expect(json).toEqual(
      oneError(
        400,
        CODES.blank,
        'This field may not be blank.',
        '/data/attributes/subject'
      )
    );
  });

  it('answers an unknown entry with a 404', async () => {
    const {status, json} = await send(
      'PATCH',
      '/entries/99',
      editEntry('99', {subject: 'x'})
    );
    expect(status).toBe(404);
    expect(json).toEqual(
      oneError(404, CODES.notFound, 'No TextEntry matches the given query.')
    );
  });
});

describe('POST /tags_entries', () => {
  it('tags the entry, and updates the counts, the linkage and the revisions', async () => {
    const [tagsBefore, entriesBefore] = [await getTags(), await getEntries()];
    const {status, json} = await send(
      'POST',
      '/tags_entries',
      tagEntry('2', '1')
    );
    expect(status).toBe(201);
    const {data: junction, included} = tagTextEntryDocumentSchema.parse(json);

    // At the bottom of the tag (empty: rank 0), with a new revision.
    expect(junction.attributes.order).toBe(0);
    expect(junction.relationships).toEqual({
      tag: {data: {type: 'Tag', id: '2'}},
      text_entry: {data: {type: 'TextEntry', id: '1'}},
      user: {data: {type: 'User', id: '1'}},
    });
    expect(
      junction.attributes.date_updated >
        latest(
          (entriesBefore.included ?? []).map(resource =>
            resource.type === 'TagTextEntryThroughModel'
              ? resource.attributes.date_updated
              : ''
          )
        )
    ).toBe(true);

    // The tag, the entry and the owner, as they are now.
    expect(identifiers(included)).toEqual(['Tag:2', 'TextEntry:1', 'User:1']);
    const tags = await getTags();
    const entries = await getEntries();
    const tag = tagOf(tags, '2');
    const entry = entryOf(entries, '1');
    expect(included).toEqual([tag, entry, expect.objectContaining({id: '1'})]);

    // The triggers: the counts, the tag last used now, and a new revision
    // of the tag and of the entry, which advances the entry's other tag too.
    expect(tag.attributes).toEqual({
      ...tagOf(tagsBefore, '2').attributes,
      entry_count: 1,
      date_last_used: junction.attributes.date_created,
      date_updated: tag.attributes.date_updated,
    });
    const newestTagBefore = latest(
      tagsBefore.data.map(candidate => candidate.attributes.date_updated)
    );
    for (const id of ['1', '2']) {
      expect(tagOf(tags, id).attributes.date_updated > newestTagBefore).toBe(
        true
      );
    }
    expect(tagOf(tags, '3')).toEqual(tagOf(tagsBefore, '3'));
    expect(entry.attributes.tag_count).toBe(2);
    expect(
      entry.attributes.date_updated >
        latest(
          entriesBefore.data.map(candidate => candidate.attributes.date_updated)
        )
    ).toBe(true);
    expect(entry.relationships.text_entry_to_tag).toEqual({
      data: [
        {type: 'TagTextEntryThroughModel', id: '1'},
        {type: 'TagTextEntryThroughModel', id: junction.id},
      ],
      meta: {count: 2},
    });
    expect(junctionIds(entries)).toContain(junction.id);
  });

  it('answers with the junction there is, changing nothing', async () => {
    const first = await send('POST', '/tags_entries', tagEntry('2', '1'));
    const [tags, entries] = [await getTags(), await getEntries()];
    const again = await send('POST', '/tags_entries', tagEntry('2', '1'));
    expect(again.status).toBe(201);
    expect(again.json).toEqual(first.json);
    expect(await getTags()).toEqual(tags);
    expect(await getEntries()).toEqual(entries);

    // Entry 1 is in tag 1 already, as junction 1.
    const {json} = await send('POST', '/tags_entries', tagEntry('1', '1'));
    expect(tagTextEntryDocumentSchema.parse(json).data.id).toBe('1');
  });

  it('ranks each new junction below the tag others', async () => {
    const ranks: number[] = [];
    for (const entryId of ['1', '2']) {
      const {json} = await send(
        'POST',
        '/tags_entries',
        tagEntry('3', entryId)
      );
      ranks.push(tagTextEntryDocumentSchema.parse(json).data.attributes.order);
    }
    expect(ranks).toEqual([0, 1]);
    expect(tagOf(await getTags(), '3').attributes.entry_count).toBe(2);
  });

  it('reports every invalid relationship', async () => {
    const {status, json} = await send('POST', '/tags_entries', {
      data: {
        type: 'TagTextEntryThroughModel',
        relationships: {text_entry: {data: {type: 'TextEntry', id: '99'}}},
      },
    });
    expect(status).toBe(400);
    expect(json).toEqual({
      errors: [
        ...oneError(
          400,
          CODES.required,
          'This field is required.',
          '/data/relationships/tag'
        ).errors,
        ...oneError(
          400,
          CODES.doesNotExist,
          'Invalid pk "99" - object does not exist.',
          '/data/relationships/text_entry'
        ).errors,
      ],
    });
  });

  it('writes to the runtime override of the entries, not to its source', async () => {
    const source = structuredClone(manyEntriesResponse);
    setRuntimeEntriesOverride(manyEntriesResponse);
    const [entry] = manyEntriesResponse.data;
    invariant(entry, 'the override has entries');
    const {status, json} = await send(
      'POST',
      '/tags_entries',
      tagEntry('4', entry.id)
    );
    expect(status).toBe(201);
    const {data} = tagTextEntryDocumentSchema.parse(json);
    expect(junctionIds(await getEntries())).toContain(data.id);
    expect(manyEntriesResponse).toEqual(source);
  });
});

describe('DELETE /tags_entries/:id', () => {
  it("keeps the counts right when the runtime override's junctions go", async () => {
    setRuntimeEntriesOverride(manyEntriesResponse);
    const tagOne = (manyEntriesResponse.included ?? []).filter(
      resource =>
        resource.type === 'TagTextEntryThroughModel' &&
        resource.relationships.tag.data.id === '1'
    );
    expect(tagOne.length).toBeGreaterThanOrEqual(3);
    for (const junction of tagOne.slice(0, 3)) {
      expect(
        (await send('DELETE', `/tags_entries/${junction.id}`)).status
      ).toBe(200);
    }
    // getTags parses with the schema, which refuses a negative count.
    expect(tagOf(await getTags(), '1')?.attributes.entry_count).toBe(
      tagOne.length - 3
    );
  });

  it('untags the entry, and updates the counts, the linkage and the revisions', async () => {
    const {json} = await send('POST', '/tags_entries', tagEntry('2', '1'));
    const junction = tagTextEntryDocumentSchema.parse(json).data;
    const [tagsBefore, entriesBefore] = [await getTags(), await getEntries()];

    const {status} = await send('DELETE', `/tags_entries/${junction.id}`);
    expect(status).toBe(200);

    const tags = await getTags();
    const entries = await getEntries();
    const entry = entryOf(entries, '1');
    expect(tagOf(tags, '2').attributes).toMatchObject({
      entry_count: 0,
      date_last_used: null,
    });
    // The tag it left, and the one it is still in, advance.
    const newestTagBefore = latest(
      tagsBefore.data.map(candidate => candidate.attributes.date_updated)
    );
    for (const id of ['1', '2']) {
      expect(tagOf(tags, id).attributes.date_updated > newestTagBefore).toBe(
        true
      );
    }
    expect(entry.attributes.tag_count).toBe(1);
    expect(
      entry.attributes.date_updated >
        latest(
          entriesBefore.data.map(candidate => candidate.attributes.date_updated)
        )
    ).toBe(true);
    expect(entry.relationships.text_entry_to_tag).toEqual({
      data: [{type: 'TagTextEntryThroughModel', id: '1'}],
      meta: {count: 1},
    });
    expect(junctionIds(entries)).not.toContain(junction.id);
  });

  it('dates the tag last used by its newest remaining junction', async () => {
    const {status} = await send('DELETE', '/tags_entries/1');
    expect(status).toBe(200);
    const tag = tagOf(await getTags(), '1');
    expect(tag.attributes.entry_count).toBe(1);
    // Junction 2's.
    expect(tag.attributes.date_last_used).toBe('2020-04-13T18:20:00');
  });

  it('keeps the deleted junction, which tagging the pair again restores', async () => {
    const tagged = await send('POST', '/tags_entries', tagEntry('3', '2'));
    const first = tagTextEntryDocumentSchema.parse(tagged.json).data;
    expect((await send('DELETE', `/tags_entries/${first.id}`)).status).toBe(
      200
    );
    const listed = tagTextEntryListDocumentSchema.parse(
      (await send('GET', '/tags_entries?filter[tag.id]=3')).json
    );
    expect(listed.data).toEqual([
      expect.objectContaining({
        id: first.id,
        attributes: expect.objectContaining({is_deleted: true}),
      }),
    ]);
    const again = tagTextEntryDocumentSchema.parse(
      (await send('POST', '/tags_entries', tagEntry('3', '2'))).json
    ).data;
    expect(again.id).toBe(first.id);
    expect(again.attributes.is_deleted).toBe(false);
    // A new junction still gets an id no junction had.
    const other = tagTextEntryDocumentSchema.parse(
      (await send('POST', '/tags_entries', tagEntry('4', '2'))).json
    ).data;
    expect(Number(other.id)).toBeGreaterThan(Number(first.id));
  });

  it('answers an unknown junction with a 404', async () => {
    const {status, json} = await send('DELETE', '/tags_entries/99');
    expect(status).toBe(404);
    expect(json).toEqual(
      oneError(
        404,
        CODES.notFound,
        'No TagTextEntryThroughModel matches the given query.'
      )
    );
  });
});

describe('keyset pages (the sync reads)', () => {
  it('list every row past the cursor in revision order, a page at a time', async () => {
    const first = tagCursorListDocumentSchema.parse(
      (await send('GET', `/tags?page[after]=${CURSOR_START}&page[size]=3`)).json
    );
    expect(first.data.map(({id}) => id)).toEqual(['1', '2', '3']);
    invariant(first.links.next, 'a page follows');
    const last = first.data.at(-1);
    invariant(last, 'the page has rows');
    const second = tagCursorListDocumentSchema.parse(
      (
        await send(
          'GET',
          `/tags?page[after]=${encodeURIComponent(cursorOf(last))}&page[size]=3`
        )
      ).json
    );
    expect(second.data.map(({id}) => id)).toEqual(['4']);
    expect(second.links.next).toBeNull();
  });

  it('list a deleted entry, with a new revision', async () => {
    expect((await send('DELETE', '/entries/2')).status).toBe(200);
    const page = textEntryCursorListDocumentSchema.parse(
      (await send('GET', `/entries?page[after]=${CURSOR_START}`)).json
    );
    // Its revision advanced past the others'.
    expect(entryIdsAndDeletion(page.data)).toEqual([
      ['1', false],
      ['3', false],
      ['2', true],
    ]);
  });

  it('keep a deleted tag, with a new revision', async () => {
    const before = tagOf(await getTags(), '3').attributes.date_updated;
    expect((await send('DELETE', '/tags/3')).status).toBe(200);
    const tag = tagOf(await getTags(), '3');
    expect(tag.attributes.is_deleted).toBe(true);
    expect(tag.attributes.date_updated > before).toBe(true);
  });

  it('filter by a revision strictly newer, whatever the id', async () => {
    // Tag 1's revision exactly: tags with it are not changed since.
    const tag = tagOf(await getTags(), '1');
    const since = await send(
      'GET',
      `/tags_entries?filter[date_updated.gt]=${encodeURIComponent('2020-04-13T18:20:00')}`
    );
    expect(since.json.data).toEqual([]);
    const tags = tagCursorListDocumentSchema.parse(
      (
        await send(
          'GET',
          `/tags?page[after]=${CURSOR_START}&filter[date_updated.gt]=${encodeURIComponent(tag.attributes.date_updated)}`
        )
      ).json
    );
    expect(tags.data.map(({id}) => id)).toEqual(['2', '3', '4']);
  });

  it("list a tag's junctions changed by an edit of their entry", async () => {
    const tagOne = async (after = CURSOR_START) =>
      tagTextEntryCursorListDocumentSchema.parse(
        (
          await send(
            'GET',
            `/tags_entries?filter[tag.id]=1&page[after]=${encodeURIComponent(after)}&include=text_entry`
          )
        ).json
      );
    const all = await tagOne();
    const last = all.data.at(-1);
    invariant(last, 'tag 1 has junctions');
    expect(all.included?.map(({id}) => id)).toEqual(['1', '2']);
    expect((await tagOne(cursorOf(last))).data).toEqual([]);

    await send('PATCH', '/entries/2', editEntry('2', {body: 'edited'}));
    const changed = await tagOne(cursorOf(last));
    expect(changed.data.map(({id}) => id)).toEqual(['2']);
    expect(changed.included).toEqual([
      expect.objectContaining({
        id: '2',
        attributes: expect.objectContaining({body: 'edited'}),
      }),
    ]);
  });
});

const entryIdsAndDeletion = (
  entries: ReadonlyArray<{id: string; attributes: {is_deleted: boolean}}>
) => entries.map(({id, attributes}) => [id, attributes.is_deleted]);

describe('GET /user/backup', () => {
  const getBackup = async () =>
    backupSchema.parse((await send('GET', '/user/backup')).json);

  it("holds the user's rows, in the API's order, with their ids", async () => {
    const backup = await getBackup();
    expect(backup.user).toEqual({id: '1', username: 'test'});
    const tags = await getTags();
    expect(backup.tags.map(({id}) => id)).toEqual(
      [...tags.data]
        .sort((a, b) => a.attributes.order - b.attributes.order)
        .map(({id}) => id)
    );
    expect(backup.entries.map(({id}) => id)).toEqual(['1', '2', '3']);
    expect(
      backup.tags_entries.map(row => [row.tag_id, row.text_entry_id])
    ).toEqual([
      ['1', '1'],
      ['1', '2'],
    ]);
    expect(backup.entry_reuses).toEqual([]);
  });

  it('leaves out what is deleted, and the taggings of it', async () => {
    expect((await send('DELETE', '/tags/1')).status).toBe(200);
    expect((await send('DELETE', '/entries/3')).status).toBe(200);
    const backup = await getBackup();
    expect(backup.tags.map(({id}) => id)).not.toContain('1');
    expect(backup.entries.map(({id}) => id)).toEqual(['1', '2']);
    expect(backup.tags_entries).toEqual([]);
  });
});

describe('POST /user/restore', () => {
  const getBackup = async () =>
    backupSchema.parse((await send('GET', '/user/backup')).json);
  const restore = async (body: unknown) => {
    const sent = await send('POST', '/user/restore', body, {
      'Content-Type': 'application/json',
    });
    if (sent.status === 200) {
      named = restoreResultSchema.parse(sent.json).data_version;
    }
    return sent;
  };

  it("replaces the user's data with the backup's, made anew", async () => {
    const before = await getBackup();
    const [entry] = before.entries;
    const [first, second] = before.tags;
    invariant(entry && first && second, 'the mock has entries and tags');
    const incoming: Backup = {
      ...before,
      tags: [
        {...second, id: '90', order: 1},
        {...first, id: '91', name: 'new', order: 0},
      ],
      entries: [{...entry, id: '92', subject: 'moved'}],
      tags_entries: [
        {
          id: '93',
          tag_id: '90',
          text_entry_id: '92',
          order: 0,
          date_created: entry.date_created,
          date_updated: entry.date_updated,
        },
      ],
      entry_reuses: [
        {id: '94', text_entry_id: '92', date_created: entry.date_created},
      ],
    };

    const {status, json} = await restore(incoming);

    expect(status).toBe(200);
    expect(restoreResultSchema.parse(json)).toEqual({
      data_version: 2,
      tags: 2,
      entries: 1,
      tags_entries: 1,
      entry_reuses: 1,
    });
    const after = await getBackup();
    expect(after.tags.map(({name}) => name)).toEqual(['new', second.name]);
    expect(after.entries.map(({subject}) => subject)).toEqual(['moved']);
    expect(after.entries[0]?.id).not.toBe(entry.id);
    const [tagging] = after.tags_entries;
    expect(tagging?.text_entry_id).toBe(after.entries[0]?.id);
    // A new version: every row is new, and the old rows are not listed.
    expect(tagging?.tag_id).not.toBe(second.id);
    const entries = await getEntries();
    expect(entries.data.map(({id}) => id)).toEqual([after.entries[0]?.id]);
    expect(
      entryOf(entries, after.entries[0]?.id ?? '').attributes
    ).toMatchObject({tag_count: 1, reused_count: 1, is_deleted: false});
    // The version before is kept, as it was.
    const kept = backupSchema.parse(
      (await send('GET', '/user/backup?version=1')).json
    );
    expect({...kept, date_exported: ''}).toEqual({
      ...before,
      date_exported: '',
    });
  });

  it('refuses a backup naming a tag or entry it does not hold, changing nothing', async () => {
    const before = await getBackup();
    const [tagging] = before.tags_entries;
    invariant(tagging, 'the mock has taggings');
    const {status} = await restore({
      ...before,
      tags_entries: [{...tagging, tag_id: '999'}],
    });
    expect(status).toBe(400);
    expect({...(await getBackup()), date_exported: ''}).toEqual({
      ...before,
      date_exported: '',
    });
  });
});

describe('/user/data_versions', () => {
  const versions = async () =>
    dataVersionListDocumentSchema.parse(
      (await send('GET', '/user/data_versions')).json
    ).data;
  const backup = async () =>
    backupSchema.parse((await send('GET', '/user/backup')).json);
  const restoreOwn = async () => {
    const sent = await send('POST', '/user/restore', await backup(), {
      'Content-Type': 'application/json',
    });
    named = restoreResultSchema.parse(sent.json).data_version;
    return sent;
  };

  it('lists the versions, newest first, with what each holds', async () => {
    const before = await versions();
    expect(before.map(({attributes}) => attributes)).toEqual([
      expect.objectContaining({version: 1, active: true, origin: 'initial'}),
    ]);
    await restoreOwn();
    const after = await versions();
    expect(after.map(({id, attributes}) => [id, attributes.active])).toEqual([
      ['2', true],
      ['1', false],
    ]);
    expect(after[1]?.attributes.entry_count).toBe(
      before[0]?.attributes.entry_count
    );
  });

  it('makes a version active again, its data the one read', async () => {
    const [entry] = (await getEntries()).data;
    await restoreOwn();
    const {status, json} = await send(
      'POST',
      '/user/data_versions/1/activate',
      {},
      {'Content-Type': 'application/json'}
    );
    expect(status).toBe(200);
    expect(dataVersionDocumentSchema.parse(json).data.attributes.active).toBe(
      true
    );
    expect((await getEntries()).data.map(({id}) => id)).toContain(entry?.id);
    expect(
      (
        await send(
          'POST',
          '/user/data_versions/9/activate',
          {},
          {
            'Content-Type': 'application/json',
          }
        )
      ).status
    ).toBe(404);
  });

  it('deletes a version that is not active, and never the active one', async () => {
    await restoreOwn();
    expect((await send('DELETE', '/user/data_versions/2')).status).toBe(400);
    expect((await send('DELETE', '/user/data_versions/1')).status).toBe(204);
    expect((await versions()).map(({id}) => id)).toEqual(['2']);
    expect((await send('DELETE', '/user/data_versions/1')).status).toBe(404);
  });

  it('refuses a write naming no version, changing nothing', async () => {
    const before = await getTags();
    named = undefined;
    for (const sent of [
      await send('POST', '/tags', {
        data: {type: 'Tag', attributes: {name: 'n'}},
      }),
      await send('DELETE', `/tags/${before.data[0]?.id}`),
      await send('POST', '/user/restore', await backup(), {
        'Content-Type': 'application/json',
      }),
    ]) {
      expect(sent.status).toBe(400);
      expect(sent.json.errors[0].detail).toMatch(DATA_VERSION_HEADER);
    }
    expect(await getTags()).toEqual(before);
    expect((await versions()).map(({id}) => id)).toEqual(['1']);
  });

  it('refuses a read or write naming another version', async () => {
    await restoreOwn();
    const response = await fetch(`${API}/tags`, {
      headers: {[DATA_VERSION_HEADER]: '1'},
    });
    expect(response.status).toBe(409);
    expect((await response.json()).errors[0].code).toBe(
      CODES.dataVersionChanged
    );
    expect(
      (await fetch(`${API}/tags`, {headers: {[DATA_VERSION_HEADER]: '2'}}))
        .status
    ).toBe(200);
  });
});
