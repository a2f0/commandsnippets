import {and, eq} from 'drizzle-orm';
import type {SQLiteColumn, SQLiteTable} from 'drizzle-orm/sqlite-core';
import type {Db} from '../db/client';
import {ApiError, type ErrorObject} from '../lib/errors';

export interface RelatedField {
  name: string;
  table: SQLiteTable;
  id: SQLiteColumn;
  userId: SQLiteColumn;
}

/**
 * PrimaryKeyRelatedField validation for relationships in a request document,
 * with the queryset limited to the requesting user's rows.
 */
export async function resolveRelated(
  db: Db,
  userId: number,
  relationships: Record<string, string | null>,
  fields: RelatedField[]
): Promise<Record<string, number>> {
  const errors: ErrorObject[] = [];
  const ids: Record<string, number> = {};
  for (const field of fields) {
    const error = (detail: string, code: string) =>
      errors.push({
        detail,
        status: '400',
        source: {pointer: `/data/relationships/${field.name}`},
        code,
      });
    const value = relationships[field.name];
    if (value === undefined) {
      error('This field is required.', 'required');
      continue;
    }
    if (value === null) {
      error('This field may not be null.', 'null');
      continue;
    }
    const [row] = /^\d+$/.test(value)
      ? await db
          .select({id: field.id})
          .from(field.table)
          .where(and(eq(field.id, Number(value)), eq(field.userId, userId)))
          .limit(1)
      : [];
    if (row === undefined) {
      error(`Invalid pk "${value}" - object does not exist.`, 'does_not_exist');
    } else {
      ids[field.name] = row.id as number;
    }
  }
  if (errors.length > 0) {
    throw new ApiError(400, errors);
  }
  return ids;
}
