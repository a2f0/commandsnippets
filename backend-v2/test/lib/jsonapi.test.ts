import {describe, expect, it} from 'vitest';
import {ApiError} from '../../src/lib/errors';
import {parseResource, type Registry, serialize} from '../../src/lib/jsonapi';

const post = (body: string) =>
  new Request('http://localhost/', {
    method: 'POST',
    body,
    headers: {'Content-Type': 'application/vnd.api+json'},
  });

async function apiError(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('parseResource', () => {
  it('rejects malformed JSON as a parse error', async () => {
    const error = await apiError(
      parseResource(post('{not json'), {type: 'Tag'})
    );
    expect(error.status).toBe(400);
    expect(error.errors[0]?.detail).toMatch(/^JSON parse error - /);
  });

  it('rejects an empty body as missing primary data', async () => {
    const error = await apiError(parseResource(post(''), {type: 'Tag'}));
    expect(error.errors[0]?.detail).toBe(
      'Received document does not contain primary data'
    );
  });

  it('parses null relationships', async () => {
    const parsed = await parseResource(
      post(
        JSON.stringify({
          data: {type: 'Tag', relationships: {user: {data: null}}},
        })
      ),
      {type: 'Tag'}
    );
    expect(parsed.relationships).toEqual({user: null});
  });
});

describe('serialize', () => {
  const registry = {
    Thing: {
      type: 'Thing',
      load: async () => [],
      attributes: () => ({}),
      relationships: {owner: {type: 'Missing', key: () => 1}},
      defaultIncludes: [],
    },
  } as unknown as Registry;

  it('throws for an unregistered primary type', async () => {
    await expect(serialize(registry, 'Nope', [], null)).rejects.toThrow(
      'Unknown resource type Nope'
    );
  });

  it('throws when a relationship points at an unregistered type', async () => {
    await expect(
      serialize(registry, 'Thing', [{id: 1}], 'owner')
    ).rejects.toThrow('Unknown resource type Missing');
  });
});
