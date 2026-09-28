/**
 * The E2E handlers' writes, against backend-v2's behavior: what each answers
 * and how the mock state (counters, junctions, revisions) changes, as later
 * reads show it. contract.spec.ts checks the documents' shapes.
 */
import {
  CODES,
  type IncludedResource,
  type TagListDocument,
  type TagTextEntryCreateDocument,
  type TagUpdateDocument,
  type TextEntryListDocument,
  type TextEntryUpdateDocument,
  tagDocumentSchema,
  tagListDocumentSchema,
  tagTextEntryDocumentSchema,
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
beforeEach(() => {
  resetMSWState();
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
    ...(body === undefined ? {} : {body: JSON.stringify(body), headers}),
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
      id: '3',
      attributes: {
        subject: 'new',
        body: 'body',
        date_updated: data.attributes.date_updated,
        date_created: data.attributes.date_created,
        reused_count: 0,
        is_deleted: false,
        tag_count: 0,
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
    expect(entryOf(await getEntries(), '3')).toEqual(data);
  });

  it('never reuses the id of a deleted entry', async () => {
    expect((await send('DELETE', '/entries/2')).status).toBe(200);
    const {json} = await send('POST', '/entries', {
      data: {type: 'TextEntry', attributes: {subject: 'new', body: 'body'}},
    });
    const {data} = textEntryDocumentSchema.parse(json);
    // Entry 2 had junctions; a reused id would pick them up.
    expect(data.id).toBe('3');
    expect(data.attributes.tag_count).toBe(0);
    expect(
      entryOf(await getEntries(), '3')?.relationships.text_entry_to_tag
    ).toEqual({data: [], meta: {count: 0}});
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
    expect((await getEntries()).data).toHaveLength(2);
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

    // The triggers: the counts, and the tag last used now (its revision
    // stays); the entry's revision advances.
    expect(tag.attributes).toEqual({
      ...tagOf(tagsBefore, '2').attributes,
      entry_count: 1,
      date_last_used: junction.attributes.date_created,
    });
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
      ).toBe(204);
    }
    // getTags parses with the schema, which refuses a negative count.
    expect(tagOf(await getTags(), '1')?.attributes.entry_count).toBe(
      tagOne.length - 3
    );
  });

  it('untags the entry, and updates the counts, the linkage and the revisions', async () => {
    const {json} = await send('POST', '/tags_entries', tagEntry('2', '1'));
    const junction = tagTextEntryDocumentSchema.parse(json).data;
    const entriesBefore = await getEntries();

    const {status} = await send('DELETE', `/tags_entries/${junction.id}`);
    expect(status).toBe(204);

    const tags = await getTags();
    const entries = await getEntries();
    const entry = entryOf(entries, '1');
    expect(tagOf(tags, '2').attributes).toMatchObject({
      entry_count: 0,
      date_last_used: null,
    });
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
    expect(status).toBe(204);
    const tag = tagOf(await getTags(), '1');
    expect(tag.attributes.entry_count).toBe(1);
    // Junction 2's.
    expect(tag.attributes.date_last_used).toBe('2020-04-13T18:20:00');
  });

  it('never reuses the id of a deleted junction', async () => {
    const tagged = await send('POST', '/tags_entries', {
      data: {
        type: 'TagTextEntryThroughModel',
        relationships: {
          tag: {data: {type: 'Tag', id: '3'}},
          text_entry: {data: {type: 'TextEntry', id: '2'}},
        },
      },
    });
    const first = tagTextEntryDocumentSchema.parse(tagged.json).data.id;
    expect((await send('DELETE', `/tags_entries/${first}`)).status).toBe(204);
    const again = await send('POST', '/tags_entries', {
      data: {
        type: 'TagTextEntryThroughModel',
        relationships: {
          tag: {data: {type: 'Tag', id: '3'}},
          text_entry: {data: {type: 'TextEntry', id: '2'}},
        },
      },
    });
    expect(tagTextEntryDocumentSchema.parse(again.json).data.id).toBe(
      String(Number(first) + 1)
    );
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
