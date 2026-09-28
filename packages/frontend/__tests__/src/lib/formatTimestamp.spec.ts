import {describe, expect, it} from 'vitest';

import {formatTimestamp} from '../../../src/lib/formatTimestamp';

const format = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);

describe('formatTimestamp', () => {
  it("reads the API's naive timestamps as UTC", () => {
    expect(formatTimestamp('2026-01-02T03:04:05.123456', 'en-US')).toBe(
      format(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))
    );
  });

  it('keeps an explicit zone', () => {
    expect(formatTimestamp('2026-01-02T03:04:05+02:00', 'en-US')).toBe(
      format(new Date(Date.UTC(2026, 0, 2, 1, 4, 5)))
    );
  });

  it('returns anything unparseable as is', () => {
    expect(formatTimestamp('not a date', 'en-US')).toBe('not a date');
  });
});
