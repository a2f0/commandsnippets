import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {formatMicros, parseDateTime} from '../src/datetime';

describe('formatMicros', () => {
  test('formats microseconds as fixed-width naive UTC', () => {
    expect(
      formatMicros(Date.UTC(2021, 0, 15, 14, 52, 32) * 1000 + 404803)
    ).toBe('2021-01-15T14:52:32.404803');
    expect(formatMicros(Date.UTC(2021, 0, 15) * 1000)).toBe(
      '2021-01-15T00:00:00.000000'
    );
  });
});

describe('parseDateTime', () => {
  test.each([
    ['2021-01-15 14:52:32.404803+00', '2021-01-15T14:52:32.404803'],
    ['2022-02-25 00:29:04.5224+00', '2022-02-25T00:29:04.522400'],
    ['2021-01-15T14:52:32.123Z', '2021-01-15T14:52:32.123000'],
    ['2021-01-15 19:52:32.4+05:00', '2021-01-15T14:52:32.400000'],
    ['2021-01-15 09:52:32-0500', '2021-01-15T14:52:32.000000'],
    ['2021-01-15T14:52', '2021-01-15T14:52:00.000000'],
    ['2021-01-15T14:52:32.123456789', '2021-01-15T14:52:32.123456'],
    [' 2021-01-15 ', '2021-01-15T00:00:00.000000'],
    ['2021-01-15', '2021-01-15T00:00:00.000000'],
  ])('parses %s', (input, expected) => {
    expect(parseDateTime(input)).toBe(expected);
  });

  test.each([
    'garbage',
    '2021-13-45 00:00:00',
    '2021-01-15T14:52:32.1234567891',
    '2021-1-1',
    '',
  ])('rejects %j', input => {
    expect(parseDateTime(input)).toBeNull();
  });

  test('imports nothing, so the Bun scripts can load it outside a bundler', () => {
    const source = readFileSync(
      new URL('../src/datetime.ts', import.meta.url),
      'utf8'
    );
    expect(source).not.toMatch(/^\s*(import|export .* from)\b/m);
  });
});
