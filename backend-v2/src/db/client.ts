import {type SQL, sql} from 'drizzle-orm';
import {type DrizzleD1Database, drizzle} from 'drizzle-orm/d1';
import type {SQLiteColumn} from 'drizzle-orm/sqlite-core';
import * as schema from './schema';

export type Db = DrizzleD1Database<typeof schema>;

export function createDb(d1: D1Database): Db {
  return drizzle(d1, {schema});
}

/**
 * `column IN (...)` bound as a single JSON parameter, which sidesteps D1's
 * 100-bound-parameter limit for large id lists.
 */
export function inIds(column: SQLiteColumn, ids: number[]): SQL {
  return sql`${column} IN (SELECT value FROM json_each(${JSON.stringify(ids)}))`;
}
