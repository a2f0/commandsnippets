import {describe, expect, it} from 'vitest';
import {
  booleanField,
  charField,
  choiceField,
  validate,
} from '../../src/lib/validation';

describe('validation fields', () => {
  it('charField rejects null and non-strings, trims, and allows blank when asked', () => {
    const field = charField({maxLength: 3});
    expect(field.parse(null)).toEqual({
      error: {detail: 'This field may not be null.', code: 'null'},
    });
    expect(field.parse({})).toEqual({
      error: {detail: 'Not a valid string.', code: 'invalid'},
    });
    expect(field.parse(true)).toEqual({
      error: {detail: 'Not a valid string.', code: 'invalid'},
    });
    expect(field.parse('  ab ')).toEqual({value: 'ab'});
    expect(field.parse(12)).toEqual({value: '12'});
    expect(charField({allowBlank: true}).parse('  ')).toEqual({value: ''});
  });

  it('charField measures length in characters, not UTF-16 units', () => {
    const field = charField({maxLength: 3});
    expect(field.parse('😀😀😀')).toEqual({value: '😀😀😀'});
    expect(field.parse('😀😀😀😀')).toEqual({
      error: {
        detail: 'Ensure this field has no more than 3 characters.',
        code: 'max_length',
      },
    });
  });

  it('choiceField rejects null and unknown values', () => {
    const field = choiceField(['a']);
    expect(field.parse(null)).toEqual({
      error: {detail: 'This field may not be null.', code: 'null'},
    });
    expect(field.parse('b')).toEqual({
      error: {detail: '"b" is not a valid choice.', code: 'invalid_choice'},
    });
    expect(field.parse('a')).toEqual({value: 'a'});
  });

  it('booleanField accepts DRF truthy/falsy spellings', () => {
    const field = booleanField();
    expect(field.parse('true')).toEqual({value: true});
    expect(field.parse(0)).toEqual({value: false});
    expect(field.parse('maybe')).toEqual({
      error: {detail: 'Must be a valid boolean.', code: 'invalid'},
    });
  });

  it('skips missing optional fields and missing fields under partial', () => {
    expect(validate({a: charField({required: false})}, {})).toEqual({
      valid: true,
      data: {},
    });
    expect(validate({a: charField()}, {}, {partial: true})).toEqual({
      valid: true,
      data: {},
    });
  });
});
