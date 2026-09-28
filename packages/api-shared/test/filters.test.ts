import {describe, expect, test} from 'bun:test';
import {
  booleanFieldFilter,
  booleanFilter,
  dateTimeFilter,
  integerFilter,
  pkFilter,
  textFilter,
} from '../src/filters';
import {failures, parsed} from './support';

/** A filter's one error: 400 `invalid` at `/data`. */
function refused(schema: Parameters<typeof failures>[0], value: string) {
  const [error, ...rest] = failures(schema, value);
  expect(rest).toEqual([]);
  expect(error?.code).toBe('invalid');
  expect(error?.status).toBeUndefined();
  expect(error?.pointer).toBe('/data');
  return error?.message;
}

describe('filters', () => {
  test('textFilter compares strings as given', () => {
    expect(parsed(textFilter, ' Mixed ')).toBe(' Mixed ');
  });

  test('integerFilter: signed, padded integers', () => {
    expect(parsed(integerFilter, '5')).toBe(5);
    expect(parsed(integerFilter, ' 5 ')).toBe(5);
    expect(parsed(integerFilter, '-3')).toBe(-3);
    expect(parsed(integerFilter, '007')).toBe(7);
    for (const value of ['1.0', '+1', '1e2', '0x1', 'abc']) {
      expect(refused(integerFilter, value)).toBe('Enter a number.');
    }
  });

  test('booleanFilter: DRF spellings', () => {
    expect(parsed(booleanFilter, 'yes')).toBe(true);
    expect(parsed(booleanFilter, 'False')).toBe(false);
    expect(refused(booleanFilter, 'maybe')).toBe('Enter a valid boolean.');
  });

  test('dateTimeFilter: normalized to the stored form', () => {
    expect(parsed(dateTimeFilter, '2021-01-15T14:52:32Z')).toBe(
      '2021-01-15T14:52:32.000000'
    );
    expect(refused(dateTimeFilter, 'yesterday')).toBe(
      'Enter a valid date/time.'
    );
  });

  test("the admin API's filters use DRF field wording", () => {
    expect(parsed(booleanFieldFilter, 'on')).toBe(true);
    expect(refused(booleanFieldFilter, 'maybe')).toBe(
      'Must be a valid boolean.'
    );
    expect(parsed(pkFilter, '42')).toBe(42);
    for (const value of [' 1', '-1', '1.5', 'x']) {
      expect(refused(pkFilter, value)).toBe('Must be a valid integer.');
    }
  });
});
