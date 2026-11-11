import * as orm from 'drizzle-orm';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  publicEntry,
  publicJunction,
  publicTag,
} from '../../src/resources/publicPolicy';

const policies = [
  ['tag', publicTag],
  ['entry', publicEntry],
  ['junction', publicJunction],
] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('required public visibility predicates', () => {
  it.each(policies)('%s refuses a missing conjunction', (_, predicate) => {
    vi.spyOn(orm, 'and').mockReturnValueOnce(undefined);
    expect(() => predicate(1)).toThrow('Expected a SQL condition');
  });

  it.each(policies)('%s keeps its concrete conjunction', (_, predicate) => {
    const condition: orm.SQL = predicate(1);
    expect(condition).toBeInstanceOf(orm.SQL);
  });
});
