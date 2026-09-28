/**
 * SQL for django-filter style lookups shared by resources. Filter values are
 * parsed by the collections' api-shared query schemas.
 */
import {type SQL, sql} from 'drizzle-orm';
import type {SQLiteColumn} from 'drizzle-orm/sqlite-core';

export function usernameIs(userId: SQLiteColumn, username: string): SQL {
  return sql`${userId} IN (SELECT id FROM users_user WHERE username = ${username})`;
}

/** Case-insensitive `LIKE %term%` (Django's `icontains`), with escaping. */
export function icontains(column: SQLiteColumn, term: string): SQL {
  const escaped = term.replace(/[\\%_]/g, match => `\\${match}`);
  return sql`${column} LIKE ${`%${escaped}%`} ESCAPE '\\'`;
}
