import {describe, expect, test} from 'bun:test';
import {z} from 'zod';
import {
  booleanField,
  charField,
  parseBoolean,
  pkField,
  relatedField,
} from '../src/fields';
import {failure, failures, parsed} from './support';

describe('charField', () => {
  const field = charField({maxLength: 3});

  test('requires a value that is not null', () => {
    expect(failure(field, undefined)).toEqual([
      'This field is required.',
      'required',
    ]);
    expect(failure(field, null)).toEqual([
      'This field may not be null.',
      'null',
    ]);
  });

  test('accepts strings and numbers, trimmed', () => {
    expect(parsed(field, '  ab ')).toBe('ab');
    expect(parsed(field, 12)).toBe('12');
    expect(parsed(field, 1.5)).toBe('1.5');
    expect(parsed(charField(), ` ${'x'.repeat(5000)} `)).toBe('x'.repeat(5000));
  });

  test.each([[true], [false], [{}], [[]], [['a']]])('refuses %p', value => {
    expect(failure(field, value)).toEqual(['Not a valid string.', 'invalid']);
  });

  test('refuses blank values', () => {
    for (const value of ['', '   ', '\n\t']) {
      expect(failure(field, value)).toEqual([
        'This field may not be blank.',
        'blank',
      ]);
    }
  });

  test('counts characters (code points), after trimming', () => {
    expect(parsed(field, '😀😀😀')).toBe('😀😀😀');
    expect(parsed(field, ' abc ')).toBe('abc');
    expect(failure(field, '😀😀😀😀')).toEqual([
      'Ensure this field has no more than 3 characters.',
      'max_length',
    ]);
    expect(failure(field, 1234)).toEqual([
      'Ensure this field has no more than 3 characters.',
      'max_length',
    ]);
  });
});

describe('parseBoolean and booleanField', () => {
  test.each([
    [true, true],
    [1, true],
    ['true', true],
    ['True', true],
    ['TRUE', true],
    ['1', true],
    ['on', true],
    ['yes', true],
    [false, false],
    [0, false],
    [-0, false],
    ['false', false],
    ['False', false],
    ['FALSE', false],
    ['0', false],
    ['off', false],
    ['no', false],
  ])('%p is %p', (value, expected) => {
    expect(parseBoolean(value)).toBe(expected);
    expect(parsed(booleanField(), value)).toBe(expected);
  });

  test.each([[null], [2], ['maybe'], ['Yes'], [' true'], [''], [[]], [{}]])(
    '%p is not a boolean',
    value => {
      expect(parseBoolean(value)).toBeNull();
      expect(failure(booleanField(), value)).toEqual([
        'Must be a valid boolean.',
        'invalid',
      ]);
    }
  );

  test('requires a value', () => {
    expect(failure(booleanField(), undefined)).toEqual([
      'This field is required.',
      'required',
    ]);
  });
});

describe('pkField', () => {
  test('accepts non-negative integers, as numbers or strings', () => {
    expect(parsed(pkField(), 5)).toBe('5');
    expect(parsed(pkField(), '007')).toBe('007');
    expect(parsed(pkField(), 0)).toBe('0');
    // String([1]) is '1', as DRF-era clients could send.
    expect(parsed(pkField(), [1])).toBe('1');
  });

  test('names the type it received', () => {
    const incorrect = (received: string): [string, string] => [
      `Incorrect type. Expected pk value, received ${received}.`,
      'incorrect_type',
    ];
    expect(failure(pkField(), 'x')).toEqual(incorrect('str'));
    expect(failure(pkField(), '')).toEqual(incorrect('str'));
    expect(failure(pkField(), 1.5)).toEqual(incorrect('number'));
    expect(failure(pkField(), -1)).toEqual(incorrect('number'));
    expect(failure(pkField(), 1e21)).toEqual(incorrect('number'));
    expect(failure(pkField(), true)).toEqual(incorrect('boolean'));
    expect(failure(pkField(), {})).toEqual(incorrect('object'));
    expect(failure(pkField(), [])).toEqual(incorrect('object'));
  });

  test('is required and not null', () => {
    expect(failure(pkField(), undefined)).toEqual([
      'This field is required.',
      'required',
    ]);
    expect(failure(pkField(), null)).toEqual([
      'This field may not be null.',
      'null',
    ]);
  });
});

describe('relatedField', () => {
  const field = relatedField('Tag');

  test('outputs the linkage, typed with the related type', () => {
    expect(parsed(field, '5')).toEqual({data: {type: 'Tag', id: '5'}});
  });

  test('refuses what cannot be a pk as not existing', () => {
    expect(failure(field, 'abc')).toEqual([
      'Invalid pk "abc" - object does not exist.',
      'does_not_exist',
    ]);
    expect(failure(field, '-1')).toEqual([
      'Invalid pk "-1" - object does not exist.',
      'does_not_exist',
    ]);
  });

  test('is required and not null', () => {
    expect(failure(field, undefined)).toEqual([
      'This field is required.',
      'required',
    ]);
    expect(failure(field, null)).toEqual([
      'This field may not be null.',
      'null',
    ]);
  });
});

describe('an object of fields', () => {
  const schema = z.object({
    b: charField(),
    a: booleanField(),
    c: charField({maxLength: 1}),
  });

  test('reports each failing field once, in field order', () => {
    expect(
      failures(schema, {c: 'xx', a: 'maybe'}).map(({path, code}) => [
        path,
        code,
      ])
    ).toEqual([
      [['b'], 'required'],
      [['a'], 'invalid'],
      [['c'], 'max_length'],
    ]);
  });

  test('skips absent fields when partial, and drops unknown ones', () => {
    expect(parsed(schema.partial(), {x: 1})).toEqual({});
    expect(parsed(schema.partial(), {a: 'yes'})).toEqual({a: true});
  });
});
