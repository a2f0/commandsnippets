import {describe, expect, test} from 'bun:test';
import {z} from 'zod';
import {check, errorMeta, fail, QUERY_ERROR} from '../src/issues';
import {CODES, MESSAGES} from '../src/messages';

describe('error metadata', () => {
  test('fail() reports a custom issue carrying its metadata', () => {
    const schema = z
      .unknown()
      .transform((_, ctx) =>
        fail(ctx, 'no', {code: 'x', status: 409, pointer: '/data'}, ['a'])
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
    const schema = z
      .unknown()
      .refine(() => false, check('first', 'a'))
      .refine(() => false, check('second', 'b'));
    const issues = schema.safeParse(1).error?.issues ?? [];
    expect(issues.map(issue => issue.message)).toEqual(['first']);
    expect(errorMeta(issues[0] as z.core.$ZodIssue)).toEqual({code: 'a'});
  });

  test("zod's own issues read as 400 invalid", () => {
    for (const schema of [
      z.string(),
      z.unknown().refine(() => false),
      z.unknown().refine(() => false, {params: {code: 5}}),
    ]) {
      const [issue] = schema.safeParse(5).error?.issues ?? [];
      expect(errorMeta(issue as z.core.$ZodIssue)).toEqual({code: 'invalid'});
    }
  });

  test('query errors point at the document', () => {
    expect(QUERY_ERROR).toEqual({code: 'invalid', pointer: '/data'});
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
