/**
 * A port of django-ordered-model (3.7) semantics used by Tag and
 * TagTextEntryThroughModel: new rows go to the bottom (`max + 1`, or 0), and
 * `above()`/`below()` move a row next to a reference row by shifting the rows
 * in between, bumping `date_updated` on every row they touch (the Django code
 * passed `extra_update={"date_updated": now}`) so incremental sync
 * (`filter[date_updated.gt]`) picks the new ranks up.
 *
 * Differences from the Django version, both deliberate:
 * - Ranks are scoped (`order_with_respect_to`): tags per user, junctions per
 *   tag. Django ranked every row in one global sequence. Relative order within
 *   a scope is unchanged by the switch, so imported ranks are used as-is.
 * - Deletes leave gaps rather than compacting. `above`/`below`/`to` never need
 *   dense ranks, and compaction silently rewrote ranks clients had cached
 *   without bumping `date_updated`.
 *
 * D1 has no interactive transactions, so each move is a single UPDATE that
 * only applies if the moved row still has the rank it was read with.
 */
import {type SQL, sql} from 'drizzle-orm';
import type {SQLiteColumn, SQLiteTable} from 'drizzle-orm/sqlite-core';
import type {Db} from '../db/client';
import {ApiError} from './errors';

export interface OrderedSpec {
  table: SQLiteTable;
  id: SQLiteColumn;
  order: SQLiteColumn;
  dateUpdated: SQLiteColumn;
  /** The `order_with_respect_to` column. */
  scope: SQLiteColumn;
  /**
   * The owning user's column, when a scope can hold other users' rows (legacy
   * junctions in someone's tag). Moves then only ever shift, and position
   * relative to, the mover's own rows; other users' rows are never touched.
   */
  owner?: SQLiteColumn;
}

export interface OrderedRow {
  id: number;
  order: number;
  scope: number;
  /** The row's owner, for specs with an `owner` column. */
  owner?: number;
}

const MAX_ATTEMPTS = 3;

export class OrderedModel {
  constructor(
    private readonly db: Db,
    private readonly spec: OrderedSpec
  ) {}

  /** Rank for a new row at the bottom of `scope`. */
  async nextOrder(scope: number): Promise<number> {
    const {order, table} = this.spec;
    const row = await this.db.get<{max: number | null}>(
      sql`SELECT MAX(${order}) AS max FROM ${table} WHERE ${this.spec.scope} = ${scope}`
    );
    return row?.max === null || row?.max === undefined ? 0 : row.max + 1;
  }

  /**
   * The bottom rank of `scope` as a SQL subquery, for use inside the INSERT
   * itself. Reading `MAX` and inserting in one statement keeps concurrent
   * creates from both reading the same maximum and inserting tied ranks (on
   * which `above()` is a no-op); D1 runs each statement atomically.
   */
  nextOrderSql(scope: number): SQL {
    const {order, table} = this.spec;
    return sql`(SELECT COALESCE(MAX(${order}), -1) + 1 FROM ${table} WHERE ${this.spec.scope} = ${scope})`;
  }

  /** Move `self` directly above (before) `ref`. */
  above(self: OrderedRow, ref: OrderedRow, now: string): Promise<void> {
    return this.move(self, ref, now, 'above');
  }

  /** Move `self` directly below (after) `ref`. */
  below(self: OrderedRow, ref: OrderedRow, now: string): Promise<void> {
    return this.move(self, ref, now, 'below');
  }

  private async move(
    initialSelf: OrderedRow,
    initialRef: OrderedRow,
    now: string,
    direction: 'above' | 'below'
  ): Promise<void> {
    if (initialSelf.scope !== initialRef.scope) {
      throw new Error('Cannot order rows from different scopes');
    }
    let self = initialSelf;
    let ref = initialRef;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (self.order === ref.order) {
        return;
      }
      let target: number;
      if (direction === 'above') {
        target =
          self.order > ref.order
            ? ref.order
            : ((await this.neighbor(ref, 'before')) ?? 0);
      } else {
        target =
          self.order > ref.order
            ? ((await this.neighbor(ref, 'after')) ?? 0)
            : ref.order;
      }
      if (await this.to(self, target, now, ref)) {
        return;
      }
      // Someone else moved `self` or `ref` between our read and write (the
      // target was computed from both); re-read and recompute.
      [self, ref] = await Promise.all([this.reload(self), this.reload(ref)]);
    }
    throw ApiError.of(
      409,
      'The ordering changed while it was being updated. Please retry.',
      'conflict'
    );
  }

  /**
   * Move `self` to rank `target`, shifting the rows in between by one.
   * Returns false if `self` — or `ref`, when the target was derived from it —
   * no longer has the rank it was read with.
   */
  async to(
    self: OrderedRow,
    target: number,
    now: string,
    ref?: OrderedRow
  ): Promise<boolean> {
    if (self.order === target) {
      return true;
    }
    const {table, id, order, dateUpdated, scope} = this.spec;
    const [low, high, delta] =
      self.order > target
        ? [target, self.order - 1, 1]
        : [self.order + 1, target, -1];
    // The guard subqueries are uncorrelated, so SQLite evaluates them once,
    // before any row is modified.
    const refGuard =
      ref === undefined
        ? sql``
        : sql`AND (SELECT ${order} FROM ${table} WHERE ${id} = ${ref.id}) = ${ref.order}`;
    const result = await this.db.run(sql`
      UPDATE ${table}
      SET ${sql.identifier(order.name)} = CASE
            WHEN ${id} = ${self.id} THEN ${target}
            ELSE ${order} + ${delta}
          END,
          ${sql.identifier(dateUpdated.name)} = ${now}
      WHERE ${scope} = ${self.scope}
        ${this.ownedBy(self)}
        AND (${id} = ${self.id} OR ${order} BETWEEN ${low} AND ${high})
        AND (SELECT ${order} FROM ${table} WHERE ${id} = ${self.id}) = ${self.order}
        ${refGuard}
    `);
    return result.meta.changes > 0;
  }

  /** `AND owner = <row's owner>` for specs with an owner column. */
  private ownedBy(row: OrderedRow): SQL {
    const {owner} = this.spec;
    if (owner === undefined) {
      return sql``;
    }
    if (row.owner === undefined) {
      throw new Error('An owned ordering needs the row owner');
    }
    return sql`AND ${owner} = ${row.owner}`;
  }

  private async neighbor(
    ref: OrderedRow,
    side: 'before' | 'after'
  ): Promise<number | null> {
    const {table, order, scope} = this.spec;
    const owned = this.ownedBy(ref);
    const row = await this.db.get<{value: number | null}>(
      side === 'before'
        ? sql`SELECT MAX(${order}) AS value FROM ${table} WHERE ${scope} = ${ref.scope} ${owned} AND ${order} < ${ref.order}`
        : sql`SELECT MIN(${order}) AS value FROM ${table} WHERE ${scope} = ${ref.scope} ${owned} AND ${order} > ${ref.order}`
    );
    return row?.value ?? null;
  }

  private async reload(row: OrderedRow): Promise<OrderedRow> {
    const {table, id, order, scope, owner} = this.spec;
    const ownerColumn = owner === undefined ? sql`` : sql`, ${owner} AS owner`;
    const fresh = await this.db.get<OrderedRow>(
      sql`SELECT ${id} AS id, ${order} AS "order", ${scope} AS scope ${ownerColumn} FROM ${table} WHERE ${id} = ${row.id}`
    );
    if (fresh === undefined) {
      throw ApiError.of(404, 'Not found.', 'not_found');
    }
    return fresh;
  }
}
