/** django-filter style lookups shared by resources. */
import {type SQL, sql} from 'drizzle-orm';
import type {SQLiteColumn} from 'drizzle-orm/sqlite-core';
import {parseDateTime} from '../lib/clock';
import {queryError} from '../lib/errors';
import {parseBoolean} from '../lib/validation';

export function integer(value: string): number {
  if (!/^-?\d+$/.test(value.trim())) {
    throw queryError('Enter a number.');
  }
  return Number(value);
}

export function boolean(value: string): boolean {
  const parsed = parseBoolean(value);
  if (parsed === null) {
    throw queryError('Enter a valid boolean.');
  }
  return parsed;
}

export function dateTime(value: string): string {
  const parsed = parseDateTime(value);
  if (parsed === null) {
    throw queryError('Enter a valid date/time.');
  }
  return parsed;
}

export function usernameIs(userId: SQLiteColumn, username: string): SQL {
  return sql`${userId} IN (SELECT id FROM users_user WHERE username = ${username})`;
}

/** Case-insensitive `LIKE %term%` (Django's `icontains`), with escaping. */
export function icontains(column: SQLiteColumn, term: string): SQL {
  const escaped = term.replace(/[\\%_]/g, match => `\\${match}`);
  return sql`${column} LIKE ${`%${escaped}%`} ESCAPE '\\'`;
}
