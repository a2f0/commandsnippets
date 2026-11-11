import {
  booleanField,
  charField,
  fail,
  forward,
  QUERY_ERROR,
  reorderAttributesSchema,
  toErrorObject,
} from '@commandsnippets/api-shared';
import {describe, expect, it} from 'vitest';
import * as z from 'zod/mini';
import {eachField, parseOrThrow, validateFields} from '../../src/lib/validate';
import {apiErrorOf} from '../support/errors';

/** The errors `run` throws, as `[pointer, detail, code]`. */
async function errorsOf(
  run: () => unknown
): Promise<Array<[string, string, string]>> {
  const error = await apiErrorOf(run);
  expect(error.status).toBe(400);
  return error.errors.map(({source, detail, code}) => [
    source?.pointer ?? '',
    detail,
    code,
  ]);
}

describe('validation fields', () => {
  const one = (field: z.ZodMiniType, value: unknown) =>
    errorsOf(() => validateFields(z.object({f: field}), {f: value}));

  it('charField rejects null and non-strings, and trims', async () => {
    const field = charField({maxLength: 3});
    expect(await one(field, null)).toEqual([
      ['/data/attributes/f', 'This field may not be null.', 'null'],
    ]);
    expect(await one(field, {})).toEqual([
      ['/data/attributes/f', 'Not a valid string.', 'invalid'],
    ]);
    expect(await one(field, true)).toEqual([
      ['/data/attributes/f', 'Not a valid string.', 'invalid'],
    ]);
    expect(await one(field, '  ')).toEqual([
      ['/data/attributes/f', 'This field may not be blank.', 'blank'],
    ]);
    const schema = z.object({f: field});
    expect(validateFields(schema, {f: '  ab '})).toEqual({f: 'ab'});
    expect(validateFields(schema, {f: 12})).toEqual({f: '12'});
  });

  it('charField measures length in characters, not UTF-16 units', async () => {
    const field = charField({maxLength: 3});
    expect(validateFields(z.object({f: field}), {f: '😀😀😀'})).toEqual({
      f: '😀😀😀',
    });
    expect(await one(field, '😀😀😀😀')).toEqual([
      [
        '/data/attributes/f',
        'Ensure this field has no more than 3 characters.',
        'max_length',
      ],
    ]);
  });

  it('booleanField accepts DRF truthy/falsy spellings', async () => {
    const schema = z.object({f: booleanField()});
    expect(validateFields(schema, {f: 'true'})).toEqual({f: true});
    expect(validateFields(schema, {f: 0})).toEqual({f: false});
    expect(await one(booleanField(), 'maybe')).toEqual([
      ['/data/attributes/f', 'Must be a valid boolean.', 'invalid'],
    ]);
  });

  it('reports every missing field in order, and skips them under partial', async () => {
    const schema = z.object({b: charField(), a: charField()});
    expect(await errorsOf(() => validateFields(schema, {}))).toEqual([
      ['/data/attributes/b', 'This field is required.', 'required'],
      ['/data/attributes/a', 'This field is required.', 'required'],
    ]);
    expect(validateFields(z.partial(schema), {})).toEqual({});
  });

  it('points under the given base', async () => {
    expect(
      await errorsOf(() =>
        validateFields(z.object({f: charField()}), {}, '/data/relationships')
      )
    ).toEqual([
      ['/data/relationships/f', 'This field is required.', 'required'],
    ]);
  });
});

describe('parseOrThrow', () => {
  it('throws only the first error, with its status and pointer', async () => {
    const first = z.pipe(
      z.unknown(),
      z.transform((_, ctx) =>
        fail(ctx, 'first', {code: 'not_found', status: 404, pointer: '/data'})
      )
    );
    const schema = z.pipe(
      z.unknown(),
      z.transform((value, ctx) => {
        forward(ctx, first.safeParse(value).error?.issues ?? []);
        return fail(ctx, 'second', QUERY_ERROR);
      })
    );
    expect(
      schema.safeParse(1).error?.issues.map(issue => issue.message)
    ).toEqual(['first', 'second']);
    const error = await apiErrorOf(() => parseOrThrow(schema, 1));
    expect(error.status).toBe(404);
    expect(error.errors).toEqual([
      {
        detail: 'first',
        status: '404',
        source: {pointer: '/data'},
        code: 'not_found',
      },
    ]);
  });

  it('returns the parsed value', () => {
    expect(parseOrThrow(z.pipe(z.string(), z.transform(Number)), '5')).toBe(5);
  });
});

// With zod's English locale, which src/lib/validate.ts loads.
describe('toErrorObject', () => {
  it('reads zod issues without metadata as 400 invalid at /data', () => {
    const [issue] = z.string().safeParse(5).error?.issues ?? [];
    if (issue === undefined) {
      throw new Error('Expected an issue');
    }
    expect(toErrorObject(issue)).toEqual({
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
