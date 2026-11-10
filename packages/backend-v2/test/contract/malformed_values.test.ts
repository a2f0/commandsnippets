import {expect, it} from 'vitest';
import {clientFor, json, userFactory} from '../helpers';

// Valid JSON whose conversion to a string throws (also inside arrays).
const malformed = {toString: 0};

it.each([
  {
    member: 'data.id',
    path: '/api/v1/tags',
    data: {type: 'Tag', id: malformed, attributes: {name: 'x'}},
    status: 400,
    code: 'parse_error',
    pointer: '/data',
  },
  {
    member: 'data.type',
    path: '/api/v1/tags',
    data: {type: malformed, attributes: {name: 'x'}},
    status: 409,
    code: 'error',
    pointer: '/data',
  },
  {
    member: 'relationship id',
    path: '/api/v1/entry_reuses',
    data: {
      type: 'TextEntryReused',
      relationships: {text_entry: {data: {type: 'TextEntry', id: [malformed]}}},
    },
    status: 400,
    code: 'invalid',
    pointer: '/data/relationships/text_entry',
  },
  {
    member: 'primary key attribute',
    path: '/api/v1/tags/reorder',
    data: {type: 'Tag', attributes: {top: malformed, bottom: 1}},
    status: 400,
    code: 'incorrect_type',
    pointer: '/data/attributes/top',
  },
])('reports uncoercible $member as a client error', async testCase => {
  const client = await clientFor(await userFactory({}, {examples: false}));
  const response = await client.post(testCase.path, {data: testCase.data});
  expect(response.status).toBe(testCase.status);
  expect((await json(response)).errors).toContainEqual(
    expect.objectContaining({
      code: testCase.code,
      status: String(testCase.status),
      source: {pointer: testCase.pointer},
    })
  );
  const backup = await json(await client.get('/api/v1/user/backup'));
  expect(backup.tags).toEqual([]);
  expect(backup.entry_reuses).toEqual([]);
});
