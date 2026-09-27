/**
 * DRF-style serializer field validation: same rules and messages as
 * CharField / ChoiceField / BooleanField, so API errors match the Django API.
 */
import {ApiError, type ErrorObject} from './errors';

interface FieldError {
  detail: string;
  code: string;
}

type FieldResult = {value: unknown} | {error: FieldError};

export interface Field {
  required: boolean;
  parse: (value: unknown) => FieldResult;
}

const fail = (detail: string, code: string): FieldResult => ({
  error: {detail, code},
});

interface CharOptions {
  required?: boolean;
  maxLength?: number;
  allowBlank?: boolean;
}

export function charField({
  required = true,
  maxLength,
  allowBlank = false,
}: CharOptions = {}): Field {
  return {
    required,
    parse(value) {
      if (value === null) {
        return fail('This field may not be null.', 'null');
      }
      if (
        typeof value === 'boolean' ||
        !['string', 'number'].includes(typeof value)
      ) {
        return fail('Not a valid string.', 'invalid');
      }
      // DRF CharField defaults to trim_whitespace=True.
      const text = String(value).trim();
      if (text === '' && !allowBlank) {
        return fail('This field may not be blank.', 'blank');
      }
      if (maxLength !== undefined && text.length > maxLength) {
        return fail(
          `Ensure this field has no more than ${maxLength} characters.`,
          'max_length'
        );
      }
      return {value: text};
    },
  };
}

export function choiceField(
  choices: readonly string[],
  {required = true}: {required?: boolean} = {}
): Field {
  return {
    required,
    parse(value) {
      if (value === null) {
        return fail('This field may not be null.', 'null');
      }
      if (typeof value !== 'string' || !choices.includes(value)) {
        return fail(
          `"${String(value)}" is not a valid choice.`,
          'invalid_choice'
        );
      }
      return {value};
    },
  };
}

const TRUE_VALUES = new Set([
  true,
  1,
  'true',
  'True',
  'TRUE',
  '1',
  'on',
  'yes',
]);
const FALSE_VALUES = new Set([
  false,
  0,
  'false',
  'False',
  'FALSE',
  '0',
  'off',
  'no',
]);

export function parseBoolean(value: unknown): boolean | null {
  if (TRUE_VALUES.has(value as never)) {
    return true;
  }
  if (FALSE_VALUES.has(value as never)) {
    return false;
  }
  return null;
}

export function booleanField({
  required = true,
}: {
  required?: boolean;
} = {}): Field {
  return {
    required,
    parse(value) {
      const parsed = parseBoolean(value);
      return parsed === null
        ? fail('Must be a valid boolean.', 'invalid')
        : {value: parsed};
    },
  };
}

export type ValidationResult<T> =
  | {valid: true; data: T}
  | {valid: false; errors: Record<string, FieldError[]>};

/**
 * `Serializer(data=...).is_valid()`: validate every field, collecting all
 * errors. With `partial`, missing fields are skipped (PATCH semantics).
 */
export function validate<T extends Record<string, unknown>>(
  fields: Record<keyof T & string, Field>,
  data: Record<string, unknown>,
  {partial = false}: {partial?: boolean} = {}
): ValidationResult<T> {
  const values: Record<string, unknown> = {};
  const errors: Record<string, FieldError[]> = {};
  for (const [name, field] of Object.entries<Field>(fields)) {
    if (!(name in data) || data[name] === undefined) {
      if (field.required && !partial) {
        errors[name] = [{detail: 'This field is required.', code: 'required'}];
      }
      continue;
    }
    const result = field.parse(data[name]);
    if ('error' in result) {
      errors[name] = [result.error];
    } else {
      values[name] = result.value;
    }
  }
  return Object.keys(errors).length > 0
    ? {valid: false, errors}
    : {valid: true, data: values as T};
}

/** `is_valid(raise_exception=True)` rendered as JSON:API errors. */
export function validateOrThrow<T extends Record<string, unknown>>(
  fields: Record<keyof T & string, Field>,
  data: Record<string, unknown>,
  options: {partial?: boolean; relationships?: string[]} = {}
): T {
  const result = validate<T>(fields, data, options);
  if (result.valid) {
    return result.data;
  }
  const errors: ErrorObject[] = Object.entries(result.errors).flatMap(
    ([name, fieldErrors]) =>
      fieldErrors.map(({detail, code}) => ({
        detail,
        status: '400',
        source: {
          pointer: options.relationships?.includes(name)
            ? `/data/relationships/${name}`
            : `/data/attributes/${name}`,
        },
        code,
      }))
  );
  throw new ApiError(400, errors);
}
