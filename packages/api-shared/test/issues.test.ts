import {describe, expect, test} from 'bun:test';
import * as z from 'zod/mini';
import {check, errorMeta, fail, QUERY_ERROR} from '../src/issues';
import {toErrorObject} from '../src/jsonapi/errorObject';
import {
  JSON_API_MEDIA_TYPE,
  JSON_MEDIA_TYPES,
  mediaTypeOf,
} from '../src/jsonapi/mediaTypes';
import {CODES, MESSAGES} from '../src/messages';

describe('error metadata', () => {
  test('fail() reports a custom issue carrying its metadata', () => {
    const schema = z.pipe(
      z.unknown(),
      z.transform((_, ctx) =>
        fail(ctx, 'no', {code: 'x', status: 409, pointer: '/data'}, ['a'])
      )
    );
    const [issue] = schema.safeParse(1).error?.issues ?? [];
    expect(issue?.message).toBe('no');
    expect(issue?.path).toEqual(['a']);
    expect(errorMeta(issue as z.core.$ZodIssue)).toEqual({
      code: 'x',
      status: 409,
      pointer: '/data',
    });
  });

  test('check() stops at the first failed refinement', () => {
    const schema = z.unknown().check(
      z.refine(() => false, check('first', 'a')),
      z.refine(() => false, check('second', 'b'))
    );
    const issues = schema.safeParse(1).error?.issues ?? [];
    expect(issues.map(issue => issue.message)).toEqual(['first']);
    expect(errorMeta(issues[0] as z.core.$ZodIssue)).toEqual({code: 'a'});
  });

  test("zod's own issues read as 400 invalid", () => {
    for (const schema of [
      z.string(),
      z.unknown().check(z.refine(() => false)),
      z.unknown().check(z.refine(() => false, {params: {code: 5}})),
    ]) {
      const [issue] = schema.safeParse(5).error?.issues ?? [];
      expect(errorMeta(issue as z.core.$ZodIssue)).toEqual({code: 'invalid'});
    }
  });

  test('query errors point at the document', () => {
    expect(QUERY_ERROR).toEqual({code: 'invalid', pointer: '/data'});
  });
});

describe('error objects', () => {
  const issueOf = (schema: z.ZodMiniType, input: unknown) => {
    const [issue] = schema.safeParse(input).error?.issues ?? [];
    if (issue === undefined) {
      throw new Error('Expected an issue');
    }
    return issue;
  };
  const failing = (meta: Parameters<typeof fail>[2], path?: PropertyKey[]) =>
    z.pipe(
      z.unknown(),
      z.transform((_, ctx) => fail(ctx, 'no', meta, path))
    );

  test("point at the issue's own pointer, with its status", () => {
    const issue = issueOf(failing({code: 'x', status: 409, pointer: '/p'}), 1);
    expect(toErrorObject(issue, '/data/attributes')).toEqual({
      detail: 'no',
      status: '409',
      source: {pointer: '/p'},
      code: 'x',
    });
  });

  test('point at the failing field under the base, else at /data', () => {
    const issue = issueOf(failing({code: 'x'}, ['name', 0]), 1);
    expect(toErrorObject(issue, '/data/attributes').source).toEqual({
      pointer: '/data/attributes/name/0',
    });
    expect(toErrorObject(issue)).toEqual({
      detail: 'no',
      status: '400',
      source: {pointer: '/data'},
      code: 'x',
    });
  });
});

describe('media types', () => {
  test('read a Content-Type without its parameters', () => {
    expect(mediaTypeOf('Application/JSON; charset=utf-8')).toBe(
      'application/json'
    );
    expect(mediaTypeOf(null)).toBe('');
    expect(JSON_MEDIA_TYPES.has(mediaTypeOf(JSON_API_MEDIA_TYPE))).toBe(true);
    expect(JSON_MEDIA_TYPES.has(mediaTypeOf('text/plain'))).toBe(false);
  });
});

describe('messages', () => {
  // A sample, pinned: clients and the backend's tests match on these.
  test('keep their DRF wording', () => {
    expect(MESSAGES.required).toBe('This field is required.');
    expect(MESSAGES.maxLength(24)).toBe(
      'Ensure this field has no more than 24 characters.'
    );
    expect(MESSAGES.invalidSort(['a'])).toBe('invalid sort parameter: a');
    expect(MESSAGES.invalidSort(['a', 'b'])).toBe(
      'invalid sort parameters: a,b'
    );
    expect(MESSAGES.jsonParseError('x')).toBe('JSON parse error - x');
    expect(CODES.permissionDenied).toBe('permission_denied');
    expect(CODES.conflict).toBe('error');
  });
});
