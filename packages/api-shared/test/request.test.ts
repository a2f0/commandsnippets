import {describe, expect, test} from 'bun:test';
import * as z from 'zod/mini';
import {booleanField, charField, relatedField} from '../src/fields';
import {
  createDocumentSchema,
  noFieldsSchema,
  requestEnvelopeSchema,
  updateDocumentSchema,
} from '../src/jsonapi/request';
import {failures, parsed} from './support';

/** The envelope's one error: `[message, code, status, pointer]`. */
function refusal(options: {type: string; id?: string}, document: unknown) {
  const [first, ...rest] = failures(requestEnvelopeSchema(options), document);
  expect(rest).toEqual([]);
  return [first?.message, first?.code, first?.status ?? 400, first?.pointer];
}

const NO_DATA = [
  'Received document does not contain primary data',
  'parse_error',
  400,
  '/data',
];

describe('requestEnvelopeSchema', () => {
  test('normalizes the primary data', () => {
    expect(
      parsed(requestEnvelopeSchema({type: 'Tag'}), {
        data: {
          type: 'Tag',
          id: 5,
          attributes: {name: 'x'},
          relationships: {a: {data: {type: 'X', id: 1}}, b: {data: null}},
          meta: {},
        },
      })
    ).toEqual({
      type: 'Tag',
      id: '5',
      attributes: {name: 'x'},
      relationships: {a: '1', b: null},
    });
    expect(
      parsed(requestEnvelopeSchema({type: 'Tag'}), {
        data: {type: 'Tag', attributes: ['x'], relationships: 'x'},
      })
    ).toEqual({type: 'Tag', id: undefined, attributes: {}, relationships: {}});
  });

  test.each([
    [undefined],
    [null],
    [[]],
    ['x'],
    [5],
    [{}],
    [{data: null}],
    [{data: []}],
    [{data: 'x'}],
  ])('needs primary data (%p)', document => {
    expect(refusal({type: 'Tag'}, document)).toEqual(NO_DATA);
  });

  test('the type must match (409)', () => {
    const mismatch = (received: string) => [
      `The resource object's type (${received}) is not the type that constitute ` +
        'the collection represented by the endpoint (Tag).',
      'error',
      409,
      '/data',
    ];
    expect(refusal({type: 'Tag'}, {data: {type: 'User'}})).toEqual(
      mismatch('User')
    );
    expect(refusal({type: 'Tag'}, {data: {}})).toEqual(mismatch('undefined'));
    expect(refusal({type: 'Tag'}, {data: {type: null}})).toEqual(
      mismatch('null')
    );
    expect(refusal({type: 'Tag'}, {data: {type: ['a', 'b']}})).toEqual(
      mismatch('a,b')
    );
    // Before the id and relationships.
    expect(
      refusal(
        {type: 'Tag', id: '1'},
        {data: {type: 'User', relationships: {a: 'x'}}}
      )
    ).toEqual(mismatch('User'));
  });

  test("an endpoint's id must be present (400) and the same (409)", () => {
    expect(refusal({type: 'Tag', id: '5'}, {data: {type: 'Tag'}})).toEqual([
      "The resource identifier object must contain an 'id' member",
      'parse_error',
      400,
      '/data',
    ]);
    const mismatch = (received: string) => [
      `The resource object's id (${received}) does not match the endpoint's id (5).`,
      'error',
      409,
      '/data',
    ];
    expect(
      refusal({type: 'Tag', id: '5'}, {data: {type: 'Tag', id: 6}})
    ).toEqual(mismatch('6'));
    expect(
      refusal({type: 'Tag', id: '5'}, {data: {type: 'Tag', id: null}})
    ).toEqual(mismatch('null'));
    expect(
      parsed(requestEnvelopeSchema({type: 'Tag', id: '5'}), {
        data: {type: 'Tag', id: 5},
      }).id
    ).toBe('5');
    // Without an endpoint id, any id is taken as given.
    expect(
      parsed(requestEnvelopeSchema({type: 'Tag'}), {
        data: {type: 'Tag', id: {}},
      }).id
    ).toBe('[object Object]');
  });

  test('every relationship needs resource linkage; the first bad one fails', () => {
    const invalid = (name: string) => [
      'Received data is not a valid JSONAPI Resource Identifier Object',
      'invalid',
      400,
      `/data/relationships/${name}`,
    ];
    for (const member of [
      null,
      'x',
      [],
      {},
      {data: 'x'},
      {data: [1]},
      {data: {}},
    ]) {
      expect(
        refusal(
          {type: 'Tag'},
          {data: {type: 'Tag', relationships: {a: member}}}
        )
      ).toEqual(invalid('a'));
    }
    expect(
      refusal(
        {type: 'Tag'},
        {
          data: {
            type: 'Tag',
            relationships: {a: {data: null}, b: {data: 5}, c: {data: 'x'}},
          },
        }
      )
    ).toEqual(invalid('b'));
    // `__proto__` is just a name.
    expect(
      refusal(
        {type: 'Tag'},
        JSON.parse(
          '{"data":{"type":"Tag","relationships":{"__proto__":{"data":1}}}}'
        )
      )
    ).toEqual(invalid('__proto__'));
    expect(
      parsed(
        requestEnvelopeSchema({type: 'Tag'}),
        JSON.parse(
          '{"data":{"type":"Tag","relationships":{"__proto__":{"data":null}}}}'
        )
      ).relationships
    ).toEqual(JSON.parse('{"__proto__":null}'));
  });
});

describe('document schemas', () => {
  const attributes = z.object({name: charField(), is_deleted: booleanField()});
  const create = createDocumentSchema('Tag', {
    attributes,
    relationships: z.object({owner: relatedField('User')}),
  });
  const update = updateDocumentSchema('Tag', {
    attributes: z.partial(attributes),
    relationships: noFieldsSchema,
  });

  test('output documents as clients write them', () => {
    expect(
      parsed(create, {
        data: {
          type: 'Tag',
          id: 'ignored',
          attributes: {name: ' x ', is_deleted: 'yes', extra: 1},
          relationships: {owner: {data: {type: 'Whatever', id: 3}}},
        },
      })
    ).toEqual({
      data: {
        type: 'Tag',
        attributes: {name: 'x', is_deleted: true},
        relationships: {owner: {data: {type: 'User', id: '3'}}},
      },
    });
    expect(parsed(update, {data: {type: 'Tag', id: 4}})).toEqual({
      data: {type: 'Tag', id: '4', attributes: {}, relationships: {}},
    });
  });

  test('report every field error under the document', () => {
    expect(
      failures(create, {
        data: {type: 'Tag', attributes: {is_deleted: 'x'}},
      }).map(({path, code}) => [path.join('/'), code])
    ).toEqual([
      ['data/attributes/name', 'required'],
      ['data/attributes/is_deleted', 'invalid'],
      ['data/relationships/owner', 'required'],
    ]);
  });

  test('stop at an envelope error', () => {
    expect(failures(update, {data: {type: 'Tag'}})).toEqual([
      {
        message: "The resource identifier object must contain an 'id' member",
        path: [],
        code: 'parse_error',
        pointer: '/data',
      },
    ]);
  });
});
