/**
 * Request fields with Django REST framework's rules and messages: what a
 * serializer's CharField, BooleanField and PrimaryKeyRelatedField accept, and
 * the one error each reports. Each field stops at its first failed check, so a
 * field has at most one error; an object of fields reports every failing
 * field, in field order, like `Serializer.is_valid()`.
 *
 * Fields take `unknown` input (whatever JSON the client sent) and output the
 * normalized value (a trimmed string, a boolean, a primary key).
 */
import {z} from 'zod';
import {check, fail} from './issues';
import {CODES, MESSAGES} from './messages';

const required = check(MESSAGES.required, CODES.required);
const notNull = check(MESSAGES.null, CODES.null);

/** A value that is present: DRF's `required` (absent under `.partial()`). */
const present = () =>
  z.unknown().refine(value => value !== undefined, required);

/**
 * DRF's CharField: a string or number (numbers become strings), trimmed,
 * not blank, and at most `maxLength` characters. Length counts code points,
 * like Python's `len()` and SQLite's `length()`: an emoji is one character.
 */
export function charField({maxLength}: {maxLength?: number} = {}) {
  return present()
    .refine(value => value !== null, notNull)
    .refine(
      (value): value is string | number =>
        typeof value === 'string' || typeof value === 'number',
      check(MESSAGES.notAString, CODES.invalid)
    )
    .transform(value => String(value).trim())
    .refine(text => text !== '', check(MESSAGES.blank, CODES.blank))
    .refine(
      text => maxLength === undefined || [...text].length <= maxLength,
      check(MESSAGES.maxLength(maxLength ?? 0), CODES.maxLength)
    );
}

const TRUE_VALUES = new Set<unknown>([
  true,
  1,
  'true',
  'True',
  'TRUE',
  '1',
  'on',
  'yes',
]);
const FALSE_VALUES = new Set<unknown>([
  false,
  0,
  'false',
  'False',
  'FALSE',
  '0',
  'off',
  'no',
]);

/** DRF's boolean spellings (`'yes'`, `'on'`, `1`, ...), or null. */
export function parseBoolean(value: unknown): boolean | null {
  if (TRUE_VALUES.has(value)) {
    return true;
  }
  if (FALSE_VALUES.has(value)) {
    return false;
  }
  return null;
}

/** DRF's BooleanField: any of `parseBoolean`'s spellings; null is invalid. */
export function booleanField() {
  return present()
    .refine(
      value => parseBoolean(value) !== null,
      check(MESSAGES.notABoolean, CODES.invalid)
    )
    .transform(value => parseBoolean(value) === true);
}

/**
 * The format half of DRF's PrimaryKeyRelatedField for a pk in attributes
 * (e.g. a reorder's `top`): a non-negative integer, as a number or string.
 * Outputs the pk as a string; whether the object exists is the server's
 * check (`MESSAGES.pkDoesNotExist`).
 */
export function pkField() {
  return present()
    .refine(value => value !== null, notNull)
    .transform((value, ctx) => {
      const pk = String(value);
      if (!/^\d+$/.test(pk) || typeof value === 'boolean') {
        const received = typeof value === 'string' ? 'str' : typeof value;
        return fail(ctx, MESSAGES.incorrectPkType(received), {
          code: CODES.incorrectType,
        });
      }
      return pk;
    });
}

/** A resource identifier object: `{type, id}`. */
export interface ResourceIdentifier<T extends string = string> {
  type: T;
  id: string;
}

/** A to-one relationship's linkage in a document. */
export interface ToOneLinkage<T extends string = string> {
  data: ResourceIdentifier<T>;
}

/**
 * A required to-one relationship of a request document, pointing at a `type`
 * resource. Its input is the linkage `requestEnvelopeSchema` normalized (the
 * related id as a string, or null); its output is the relationship as a
 * client writes it, `{data: {type, id}}`. Non-numeric ids cannot exist, so
 * they fail as DRF's `does_not_exist`; whether a numeric one exists (and is
 * the requester's) is the server's check, with the same message.
 */
export function relatedField<const T extends string>(type: T) {
  return present()
    .refine(value => value !== null, notNull)
    .transform((value, ctx): ToOneLinkage<T> => {
      const pk = String(value);
      if (!/^\d+$/.test(pk)) {
        return fail(ctx, MESSAGES.pkDoesNotExist(pk), {
          code: CODES.doesNotExist,
        });
      }
      return {data: {type, id: pk}};
    });
}
