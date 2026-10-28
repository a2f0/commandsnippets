import {type SQL, sql} from 'drizzle-orm';
import {type DrizzleD1Database, drizzle} from 'drizzle-orm/d1';
import {SQLiteAsyncDialect, type SQLiteColumn} from 'drizzle-orm/sqlite-core';
import * as schema from './schema';

export type Db = DrizzleD1Database<typeof schema> & {$client: D1Database};

export function createDb(d1: D1Database): Db {
  return drizzle(d1, {schema});
}

const dialect = new SQLiteAsyncDialect();

/**
 * Run raw `statements` in one D1 batch: one transaction, so a failure
 * anywhere in it undoes all of it. Drizzle (0.45) cannot batch raw
 * statements with parameters, so they are prepared on the D1 binding.
 */
export function rawBatch<T = unknown>(
  db: Db,
  statements: readonly SQL[]
): Promise<D1Result<T>[]> {
  const d1 = db.$client;
  return d1.batch<T>(
    statements.map(statement => {
      const query = dialect.sqlToQuery(statement);
      return d1.prepare(query.sql).bind(...query.params);
    })
  );
}

/**
 * `column IN (...)` bound as a single JSON parameter, which sidesteps D1's
 * 100-bound-parameter limit for large id lists.
 */
export function inIds(column: SQLiteColumn, ids: number[]): SQL {
  return sql`${column} IN (SELECT value FROM json_each(${JSON.stringify(ids)}))`;
}
