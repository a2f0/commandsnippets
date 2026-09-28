import {
  booleanField,
  charField,
  QUERY_ERROR,
  reorderAttributesSchema,
} from '@commandsnippets/api-shared';
import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {ApiError} from '../../src/lib/errors';
import {
  eachField,
  parseOrThrow,
  toErrorObject,
  validateFields,
} from '../../src/lib/validate';

/** The errors `run` throws, as `[pointer, detail, code]`. */
function errorsOf(run: () => unknown): Array<[string, string, string]> {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    return (error as ApiError).errors.map(({source, detail, code}) => [
      source?.pointer ?? '',
      detail,
      code ?? '',
    ]);
  }
  throw new Error('Expected validation to fail');
}

describe('validation fields', () => {
  const one = (field: z.ZodType, value: unknown) =>
    errorsOf(() => validateFields(z.object({f: field}), {f: value}));

  it('charField rejects null and non-strings, and trims', () => {
    const field = charField({maxLength: 3});
    expect(one(field, null)).toEqual([
      ['/data/attributes/f', 'This field may not be null.', 'null'],
    ]);
    expect(one(field, {})).toEqual([
      ['/data/attributes/f', 'Not a valid string.', 'invalid'],
    ]);
    expect(one(field, true)).toEqual([
      ['/data/attributes/f', 'Not a valid string.', 'invalid'],
    ]);
    expect(one(field, '  ')).toEqual([
      ['/data/attributes/f', 'This field may not be blank.', 'blank'],
    ]);
    const schema = z.object({f: field});
    expect(validateFields(schema, {f: '  ab '})).toEqual({f: 'ab'});
    expect(validateFields(schema, {f: 12})).toEqual({f: '12'});
  });

  it('charField measures length in characters, not UTF-16 units', () => {
    const field = charField({maxLength: 3});
    expect(validateFields(z.object({f: field}), {f: '😀😀😀'})).toEqual({
      f: '😀😀😀',
    });
    expect(one(field, '😀😀😀😀')).toEqual([
      [
        '/data/attributes/f',
        'Ensure this field has no more than 3 characters.',
        'max_length',
      ],
    ]);
  });

  it('booleanField accepts DRF truthy/falsy spellings', () => {
    const schema = z.object({f: booleanField()});
    expect(validateFields(schema, {f: 'true'})).toEqual({f: true});
    expect(validateFields(schema, {f: 0})).toEqual({f: false});
    expect(one(booleanField(), 'maybe')).toEqual([
      ['/data/attributes/f', 'Must be a valid boolean.', 'invalid'],
    ]);
  });

  it('reports every missing field in order, and skips them under partial', () => {
    const schema = z.object({b: charField(), a: charField()});
    expect(errorsOf(() => validateFields(schema, {}))).toEqual([
      ['/data/attributes/b', 'This field is required.', 'required'],
      ['/data/attributes/a', 'This field is required.', 'required'],
    ]);
    expect(validateFields(schema.partial(), {})).toEqual({});
  });

  it('points under the given base', () => {
    expect(
      errorsOf(() =>
        validateFields(z.object({f: charField()}), {}, '/data/relationships')
      )
    ).toEqual([
      ['/data/relationships/f', 'This field is required.', 'required'],
    ]);
  });
});

describe('parseOrThrow', () => {
  it('throws only the first error, with its status and pointer', () => {
    const schema = z.unknown().transform((_, ctx) => {
      ctx.addIssue({
        code: 'custom',
        message: 'first',
        params: {code: 'not_found', status: 404, pointer: '/data'},
      });
      ctx.addIssue({code: 'custom', message: 'second', params: QUERY_ERROR});
      return z.NEVER;
    });
    try {
      parseOrThrow(schema, 1);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
      expect((error as ApiError).errors).toEqual([
        {
          detail: 'first',
          status: '404',
          source: {pointer: '/data'},
          code: 'not_found',
        },
      ]);
    }
  });

  it('returns the parsed value', () => {
    expect(parseOrThrow(z.string().transform(Number), '5')).toBe(5);
  });
});

describe('toErrorObject', () => {
  it('reads zod issues without metadata as 400 invalid at /data', () => {
    const [issue] = z.string().safeParse(5).error?.issues ?? [];
    expect(toErrorObject(issue as z.core.$ZodIssue)).toEqual({
      detail: 'Invalid input: expected string, received number',
      status: '400',
      source: {pointer: '/data'},
      code: 'invalid',
    });
  });
});

describe('eachField', () => {
  it('validates each field on its own, in field order', () => {
    expect(
      eachField(reorderAttributesSchema, {bottom: '7'}, '/data/attributes')
    ).toEqual([
      {
        name: 'top',
        error: {
          detail: 'This field is required.',
          status: '400',
          source: {pointer: '/data/attributes/top'},
          code: 'required',
        },
      },
      {name: 'bottom', value: '7'},
    ]);
  });
});
