import {describe, expect, test} from 'bun:test';
import {CURSOR_START, cursorOf, isPast, parseCursor} from '../src/cursor';

describe('cursors', () => {
  test("are a row's revision as rendered, and its id", () => {
    const row = {id: '7', attributes: {date_updated: '2024-01-01T12:34:56'}};
    expect(cursorOf(row)).toBe('2024-01-01T12:34:56,7');
    expect(parseCursor(cursorOf(row))).toEqual({
      dateUpdated: '2024-01-01T12:34:56.000000',
      id: 7,
    });
  });

  test('the start is before every row', () => {
    const start = parseCursor(CURSOR_START);
    expect(start).toEqual({dateUpdated: '1970-01-01T00:00:00.000000', id: 0});
    const first = parseCursor('1970-01-01T00:00:00,1');
    expect(first !== null && start !== null && isPast(first, start)).toBe(true);
  });

  test('parse only `<date_updated>,<id>`', () => {
    for (const value of [
      '',
      ',',
      '7',
      '2024-01-01T12:34:56',
      '2024-01-01T12:34:56,',
      'x,7',
      '2024-01-01T12:34:56,7.5',
      '2024-01-01T12:34:56,-7',
    ]) {
      expect(parseCursor(value)).toBeNull();
    }
    // The last comma splits: a timestamp has none.
    expect(parseCursor('2024-01-01 12:34:56+00:00,7')).toEqual({
      dateUpdated: '2024-01-01T12:34:56.000000',
      id: 7,
    });
  });

  test('order by revision, then id', () => {
    const at = (dateUpdated: string, id: number) => ({dateUpdated, id});
    const a = at('2024-01-01T00:00:00.000001', 1);
    expect(isPast(a, at('2024-01-01T00:00:00.000000', 9))).toBe(true);
    expect(isPast(a, at('2024-01-01T00:00:00.000001', 0))).toBe(true);
    expect(isPast(a, a)).toBe(false);
    expect(isPast(at('2024-01-01T00:00:00.000001', 0), a)).toBe(false);
  });
});
