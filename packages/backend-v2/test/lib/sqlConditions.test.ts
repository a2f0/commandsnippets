import {sql} from 'drizzle-orm';
import {describe, expect, it} from 'vitest';
import {requireSql} from '../../src/lib/sqlConditions';

describe('requireSql', () => {
  it('throws for a missing predicate', () => {
    expect(() => requireSql(undefined)).toThrow('Expected a SQL condition');
  });

  it('returns a concrete predicate unchanged', () => {
    const condition = sql`1 = 1`;
    expect(requireSql(condition)).toBe(condition);
  });
});
