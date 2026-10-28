import {CODES, MESSAGES, type ToOneLinkage} from '@commandsnippets/api-shared';
import {and, eq} from 'drizzle-orm';
import type {RunnableQuery} from 'drizzle-orm/runnable-query';
import type {SQLiteColumn, SQLiteTable} from 'drizzle-orm/sqlite-core';
import type * as z from 'zod/mini';
import type {Db} from '../db/client';
import {ApiError, type ErrorObject} from '../lib/errors';
import {eachField} from '../lib/validate';

/**
 * Where a relationship's pk must be one of the requesting user's rows, of
 * the data version written.
 */
interface RelatedTable {
  table: SQLiteTable;
  id: SQLiteColumn;
  userId: SQLiteColumn;
  version: SQLiteColumn;
}

/**
 * A field to check: its own error (`eachField`), or its pk and the query
 * for its row (none: the pk does not exist). Drizzle reads a batch's rows by
 * column name, so the query's columns must be named apart.
 */
export type PkCheck<Name extends string, Row> =
  | {name: Name; error: ErrorObject}
  | {name: Name; pk: string; query: RunnableQuery<Row[], 'sqlite'>};

/**
 * PrimaryKeyRelatedField's existence check, after each field's own
 * validation: every valid field's row is looked up in one D1 batch (one
 * round trip, one moment), then every field's error is reported, in field
 * order: its own, or that its pk does not exist (a 400 with them all).
 * Otherwise each field's row.
 */
export async function existingRows<Name extends string, Row>(
  db: Db,
  pointer: string,
  checks: Array<PkCheck<Name, Row>>
): Promise<Record<Name, Row>> {
  const lookups = checks.flatMap(check => ('query' in check ? [check] : []));
  const [first, ...rest] = lookups.map(({query}) => query);
  const results = first === undefined ? [] : await db.batch([first, ...rest]);
  const errors: ErrorObject[] = [];
  const rows: Partial<Record<Name, Row>> = {};
  for (const check of checks) {
    if ('error' in check) {
      errors.push(check.error);
      continue;
    }
    const [row] = results[lookups.indexOf(check)] ?? [];
    if (row === undefined) {
      errors.push({
        detail: MESSAGES.pkDoesNotExist(check.pk),
        status: '400',
        source: {pointer: `${pointer}/${check.name}`},
        code: CODES.doesNotExist,
      });
    } else {
      rows[check.name] = row;
    }
  }
  if (errors.length > 0) {
    throw new ApiError(400, errors);
  }
  return rows as Record<Name, Row>;
}

const POINTER = '/data/relationships';

/**
 * PrimaryKeyRelatedField validation for a request document's relationships,
 * with the queryset limited to the requesting user's rows of `version`: `schema`'s fields
 * (present, not null, a pk; see api-shared's `relatedField`), then that each
 * pk exists in its `tables` entry. Every field's error is reported, in field
 * order.
 */
export async function resolveRelated<
  Shape extends Record<string, z.ZodMiniType>,
>(
  db: Db,
  userId: number,
  version: number,
  relationships: Record<string, string | null>,
  schema: z.ZodMiniObject<Shape>,
  tables: {[K in keyof Shape]: RelatedTable}
): Promise<{[K in keyof Shape]: number}> {
  const rows = await existingRows(
    db,
    POINTER,
    eachField(schema, relationships, POINTER).map(field => {
      if ('error' in field) {
        return {name: field.name, error: field.error};
      }
      const {
        table,
        id,
        userId: owner,
        version: rowVersion,
      } = tables[field.name];
      const pk = (field.value as ToOneLinkage).data.id;
      return {
        name: field.name,
        pk,
        query: db
          .select({id})
          .from(table)
          .where(
            and(eq(id, Number(pk)), eq(owner, userId), eq(rowVersion, version))
          )
          .limit(1),
      };
    })
  );
  return Object.fromEntries(
    Object.entries(rows).map(([name, row]) => [name, row.id as number])
  ) as {[K in keyof Shape]: number};
}
