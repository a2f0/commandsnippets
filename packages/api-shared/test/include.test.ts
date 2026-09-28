import {describe, expect, test} from 'bun:test';
import {
  includePathsSchema,
  includeSchema,
  MAX_INCLUDE_DEPTH,
  type RelationshipGraph,
  splitInclude,
} from '../src/include';
import {RELATIONSHIPS} from '../src/resources/types';
import {failures, parsed} from './support';

/** A cyclic graph, as the real one is. */
const graph: RelationshipGraph = {
  Parent: {children: {type: 'Child', many: true}, owner: {type: 'Owner'}},
  Child: {parent: {type: 'Parent'}},
  Owner: {},
};

const refusal = (type: string, include: string) => {
  const [error, ...rest] = failures(includeSchema(graph, type), include);
  expect(rest).toEqual([]);
  expect(error?.code).toBe('invalid');
  expect(error?.pointer).toBe('/data');
  return error?.message;
};

describe('splitInclude', () => {
  test('trims paths and drops empty ones', () => {
    expect(splitInclude(' a , b.c ,, ')).toEqual(['a', 'b.c']);
    expect(splitInclude('')).toEqual([]);
  });
});

describe('includeSchema', () => {
  test('expands paths into their prefixes, shortest first, once each', () => {
    expect(
      parsed(includeSchema(graph, 'Parent'), 'children.parent,owner,children')
    ).toEqual([['children'], ['owner'], ['children', 'parent']]);
    expect(parsed(includeSchema(graph, 'Parent'), '')).toEqual([]);
  });

  test('follows cycles up to the depth limit', () => {
    expect(MAX_INCLUDE_DEPTH).toBe(3);
    expect(
      parsed(includeSchema(graph, 'Parent'), 'children.parent.children')
    ).toEqual([
      ['children'],
      ['children', 'parent'],
      ['children', 'parent', 'children'],
    ]);
    expect(refusal('Parent', 'children.parent.children.parent')).toBe(
      'Include path children.parent.children.parent is deeper than 3 relationships.'
    );
  });

  test('refuses the first unknown path, whole', () => {
    expect(refusal('Parent', 'owner,bogus,nope')).toBe(
      'This endpoint does not support the include parameter for path bogus'
    );
    expect(refusal('Parent', 'children.nope')).toBe(
      'This endpoint does not support the include parameter for path children.nope'
    );
    expect(refusal('Parent', 'owner.')).toBe(
      'This endpoint does not support the include parameter for path owner.'
    );
    expect(refusal('Owner', 'anything')).toBe(
      'This endpoint does not support the include parameter for path anything'
    );
  });

  test.each([
    'constructor',
    'toString',
    'hasOwnProperty',
    '__proto__',
    'valueOf',
  ])('refuses %s, like any unknown name', name => {
    expect(refusal('Parent', name)).toBe(
      `This endpoint does not support the include parameter for path ${name}`
    );
    expect(refusal('Parent', `children.${name}`)).toBe(
      `This endpoint does not support the include parameter for path children.${name}`
    );
  });

  test('walks paths only over types the graph has', () => {
    const partial: RelationshipGraph = {A: {b: {type: 'B'}}};
    expect(parsed(includePathsSchema(partial, 'A'), ['b'])).toEqual([['b']]);
    expect(failures(includePathsSchema(partial, 'A'), ['b.c'])).toHaveLength(1);
    expect(failures(includePathsSchema(partial, 'Z'), ['b'])).toHaveLength(1);
  });

  test('resolves over the API graph', () => {
    expect(
      parsed(
        includeSchema(RELATIONSHIPS, 'TextEntry'),
        'text_entry_to_tag.tag.user'
      )
    ).toEqual([
      ['text_entry_to_tag'],
      ['text_entry_to_tag', 'tag'],
      ['text_entry_to_tag', 'tag', 'user'],
    ]);
  });
});
