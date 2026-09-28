import {CODES, MESSAGES, type ToOneLinkage} from '@commandsnippets/api-shared';
import {and, eq} from 'drizzle-orm';
import type {SQLiteColumn, SQLiteTable} from 'drizzle-orm/sqlite-core';
import type * as z from 'zod/mini';
import type {Db} from '../db/client';
import {ApiError, type ErrorObject} from '../lib/errors';
import {eachField} from '../lib/validate';

/** Where a relationship's pk must be one of the requesting user's rows. */
interface RelatedTable {
  table: SQLiteTable;
  id: SQLiteColumn;
  userId: SQLiteColumn;
}

const POINTER = '/data/relationships';

/**
 * PrimaryKeyRelatedField validation for a request document's relationships,
 * with the queryset limited to the requesting user's rows: `schema`'s fields
 * (present, not null, a pk; see api-shared's `relatedField`), then that each
 * pk exists in its `tables` entry. Every field's error is reported, in field
 * order.
 */
export async function resolveRelated<
  Shape extends Record<string, z.ZodMiniType>,
>(
  db: Db,
  userId: number,
  relationships: Record<string, string | null>,
  schema: z.ZodMiniObject<Shape>,
  tables: {[K in keyof Shape]: RelatedTable}
): Promise<{[K in keyof Shape]: number}> {
  const errors: ErrorObject[] = [];
  const ids: Record<string, number> = {};
  for (const field of eachField(schema, relationships, POINTER)) {
    if ('error' in field) {
      errors.push(field.error);
      continue;
    }
    const {table, id, userId: owner} = tables[field.name];
    const pk = (field.value as ToOneLinkage).data.id;
    const [row] = await db
      .select({id})
      .from(table)
      .where(and(eq(id, Number(pk)), eq(owner, userId)))
      .limit(1);
    if (row === undefined) {
      errors.push({
        detail: MESSAGES.pkDoesNotExist(pk),
        status: '400',
        source: {pointer: `${POINTER}/${field.name}`},
        code: CODES.doesNotExist,
      });
    } else {
      ids[field.name] = row.id as number;
    }
  }
  if (errors.length > 0) {
    throw new ApiError(400, errors);
  }
  return ids as {[K in keyof Shape]: number};
}
