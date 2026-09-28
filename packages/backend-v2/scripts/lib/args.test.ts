import {describe, expect, test} from 'bun:test';
import {parseOrUsage, takeFlag, UsageError} from './args';

describe('takeFlag', () => {
  test('removes the flag and its value, returning the value', () => {
    const args = ['cmd', '--out', 'file', 'rest'];
    expect(takeFlag(args, '--out')).toBe('file');
    expect(args).toEqual(['cmd', 'rest']);
  });

  test('returns undefined for an absent flag', () => {
    const args = ['cmd'];
    expect(takeFlag(args, '--out')).toBeUndefined();
    expect(args).toEqual(['cmd']);
  });

  test('refuses a flag with no value rather than treating it as absent', () => {
    expect(() => takeFlag(['cmd', '--out'], '--out')).toThrow(UsageError);
  });
});

describe('parseOrUsage', () => {
  test('returns what parse returns', () => {
    const out: string[] = [];
    expect(
      parseOrUsage(
        () => 1,
        'usage: x',
        l => out.push(l)
      )
    ).toBe(1);
    expect(out).toEqual([]);
  });

  test('prints the usage for a UsageError', () => {
    const out: string[] = [];
    expect(
      parseOrUsage(
        () => {
          throw new UsageError('bad');
        },
        'usage: x',
        l => out.push(l)
      )
    ).toBeUndefined();
    expect(out).toEqual(['usage: x']);
  });

  test('lets other errors through', () => {
    expect(() =>
      parseOrUsage(
        () => {
          throw new TypeError('bug');
        },
        'usage: x',
        () => {}
      )
    ).toThrow(TypeError);
  });
});
