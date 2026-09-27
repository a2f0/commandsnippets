import {describe, expect, it} from 'vitest';
import {
  formatMicros,
  isoformat,
  nowMicros,
  parseDateTime,
} from '../../src/lib/clock';

describe('clock', () => {
  it('is strictly monotonic within a request', () => {
    const first = nowMicros();
    expect(nowMicros()).toBeGreaterThan(first);
  });

  it('formats microseconds as fixed-width naive UTC', () => {
    expect(
      formatMicros(Date.UTC(2021, 0, 15, 14, 52, 32) * 1000 + 404803)
    ).toBe('2021-01-15T14:52:32.404803');
  });

  it('renders like Python isoformat()', () => {
    expect(isoformat('2021-01-15T14:52:32.000000')).toBe('2021-01-15T14:52:32');
    expect(isoformat('2021-01-15T14:52:32.400000')).toBe(
      '2021-01-15T14:52:32.400000'
    );
    expect(isoformat(null)).toBeNull();
  });

  it.each([
    ['2021-01-15 14:52:32.404803+00', '2021-01-15T14:52:32.404803'],
    ['2022-02-25 00:29:04.5224+00', '2022-02-25T00:29:04.522400'],
    ['2021-01-15T14:52:32.123Z', '2021-01-15T14:52:32.123000'],
    ['2021-01-15 19:52:32.4+05:00', '2021-01-15T14:52:32.400000'],
    ['2021-01-15 09:52:32-0500', '2021-01-15T14:52:32.000000'],
    ['2021-01-15', '2021-01-15T00:00:00.000000'],
  ])('parses %s', (input, expected) => {
    expect(parseDateTime(input)).toBe(expected);
  });

  it.each(['garbage', '2021-13-45 00:00:00', ''])('rejects %j', input => {
    expect(parseDateTime(input)).toBeNull();
  });
});
