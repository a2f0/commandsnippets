import type {SQL} from 'drizzle-orm';

/** Required security and ordering predicates must never become no restriction. */
export function requireSql(condition: SQL | undefined): SQL {
  if (condition === undefined) {
    throw new Error('Expected a SQL condition');
  }
  return condition;
}
