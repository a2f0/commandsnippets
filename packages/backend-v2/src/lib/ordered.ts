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
 *   tag. Django ranked every row in one global sequence; relative order within
 *   a scope is the same either way.
 * - Deletes leave gaps rather than compacting. `above`/`below`/`to` never need
 *   dense ranks, and compaction silently rewrote ranks clients had cached
 *   without bumping `date_updated`.
 *
 * D1 has no interactive transactions, so each move is a single UPDATE that
 * only applies if the moved row still has the rank it was read with.
 */
import {CODES} from '@commandsnippets/api-shared';
import {type SQL, sql} from 'drizzle-orm';
import {
  SQLiteAsyncDialect,
  type SQLiteColumn,
  type SQLiteTable,
} from 'drizzle-orm/sqlite-core';
import type {Db} from '../db/client';
import {ApiError, notFound} from './errors';

const dialect = new SQLiteAsyncDialect();

export interface OrderedSpec {
  table: SQLiteTable;
  id: SQLiteColumn;
  order: SQLiteColumn;
  dateUpdated: SQLiteColumn;
  /** The `order_with_respect_to` column. */
  scope: SQLiteColumn;
  /**
   * The owning user's column: a move reads the mover's owner with it
   * (`OrderedRow.owner`), for `touch`. (A scope holds one user's rows.)
   */
  owner?: SQLiteColumn;
  /**
   * The rows that hold a place in the order, when others do not: soft-deleted
   * junctions keep their rank but are never shifted, moved, or positioned
   * against (nor offered as a move's rows, `reorder.ts`).
   */
  ranked?: SQL;
  /**
   * A statement run in the same batch as every move (atomically), e.g. to
   * advance the revisions of parent rows clients sync the moved rows through.
   * It runs after the move's UPDATE, so `changes()` tells whether that applied.
   */
  touch?: (moved: OrderedRow) => SQL;
}

export interface OrderedRow {
  id: number;
  order: number;
  scope: number;
  /** The row's owner, for specs with an `owner` column. */
  owner?: number;
}

const MAX_ATTEMPTS = 3;

/** The neighbor rank a move's target was read from, to guard against. */
interface Neighbor {
  side: 'before' | 'after';
  rank: number;
}

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

  /**
   * Move `self` directly above (before) `ref`. `record`, when given, runs in
   * the move's transaction, right after the statement that moves the rows
   * (`changes()` is that statement's): a failure of it undoes the move.
   */
  above(
    self: OrderedRow,
    ref: OrderedRow,
    now: string | SQL,
    record?: SQL
  ): Promise<void> {
    return this.move(self, ref, now, 'above', record);
  }

  /** Move `self` directly below (after) `ref` (see `above`). */
  below(
    self: OrderedRow,
    ref: OrderedRow,
    now: string | SQL,
    record?: SQL
  ): Promise<void> {
    return this.move(self, ref, now, 'below', record);
  }

  private async move(
    initialSelf: OrderedRow,
    initialRef: OrderedRow,
    now: string | SQL,
    direction: 'above' | 'below',
    record?: SQL
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
      // Moving across a gap, the target is the reference's neighbor, which a
      // concurrent move can change without touching `self` or `ref`: guard it.
      let target: number;
      let neighbor: Neighbor | undefined;
      if (direction === 'above' && self.order < ref.order) {
        target = (await this.neighbor(ref, 'before')) ?? 0;
        neighbor = {side: 'before', rank: target};
      } else if (direction === 'below' && self.order > ref.order) {
        target = (await this.neighbor(ref, 'after')) ?? 0;
        neighbor = {side: 'after', rank: target};
      } else {
        target = ref.order;
      }
      if (await this.to(self, target, now, ref, neighbor, record)) {
        return;
      }
      // Someone else moved `self`, `ref`, or the neighbor between our read
      // and write (the target was computed from them); re-read and recompute.
      [self, ref] = await Promise.all([this.reload(self), this.reload(ref)]);
    }
    throw ApiError.of(
      409,
      'The ordering changed while it was being updated. Please retry.',
      CODES.orderingConflict
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
    now: string | SQL,
    ref?: OrderedRow,
    neighbor?: Neighbor,
    record?: SQL
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
    // before any row is modified. A row that left the order since it was
    // read (a deleted junction keeps its rank) has none: the guard fails.
    const refGuard =
      ref === undefined ? sql`` : sql`AND ${this.rankOf(ref)} = ${ref.order}`;
    const neighborGuard =
      ref === undefined || neighbor === undefined
        ? sql``
        : sql`AND ${this.neighborRank(ref, neighbor.side)} = ${neighbor.rank}`;
    const move = sql`
      UPDATE ${table}
      SET ${sql.identifier(order.name)} = CASE
            WHEN ${id} = ${self.id} THEN ${target}
            ELSE ${order} + ${delta}
          END,
          ${sql.identifier(dateUpdated.name)} = ${now}
      WHERE ${scope} = ${self.scope}
        ${this.live()}
        AND (${id} = ${self.id} OR ${order} BETWEEN ${low} AND ${high})
        AND ${this.rankOf(self)} = ${self.order}
        ${refGuard}
        ${neighborGuard}
    `;
    const touch = this.spec.touch?.(self);
    if (touch === undefined && record === undefined) {
      return (await this.db.run(move)).meta.changes > 0;
    }
    // Drizzle (0.45) cannot batch raw statements with parameters, so they are
    // prepared on the D1 binding.
    const d1 = this.db.$client;
    const [moved] = await d1.batch(
      [move, record, touch]
        .filter(statement => statement !== undefined)
        .map(statement => {
          const query = dialect.sqlToQuery(statement);
          return d1.prepare(query.sql).bind(...query.params);
        })
    );
    return (moved?.meta.changes ?? 0) > 0;
  }

  /**
   * The condition on the rows a move shifts and positions against: the spec's
   * `ranked` condition, if any.
   */
  private live(): SQL {
    const {ranked} = this.spec;
    return ranked === undefined ? sql`` : sql`AND ${ranked}`;
  }

  /** `row`'s rank as SQL: null once it is out of the order (`ranked`). */
  private rankOf(row: OrderedRow): SQL {
    const {table, id, order} = this.spec;
    return sql`(SELECT ${order} FROM ${table} WHERE ${id} = ${row.id} ${this.live()})`;
  }

  /**
   * Whether `self` is directly above `ref` now, as SQL: where `above` leaves
   * them (and leaves them be, tied).
   */
  directlyAbove(self: OrderedRow, ref: OrderedRow): SQL {
    const {table, order, scope} = this.spec;
    const [mine, theirs] = [this.rankOf(self), this.rankOf(ref)];
    return sql`(${mine} = ${theirs} OR (${mine} < ${theirs} AND NOT EXISTS (SELECT 1 FROM ${table} WHERE ${scope} = ${ref.scope} ${this.live()} AND ${order} > ${mine} AND ${order} < ${theirs})))`;
  }

  /** The rank just before or after `ref` in its scope, as SQL. */
  private neighborRank(ref: OrderedRow, side: 'before' | 'after'): SQL {
    const {table, order, scope} = this.spec;
    const live = this.live();
    return side === 'before'
      ? sql`(SELECT MAX(${order}) FROM ${table} WHERE ${scope} = ${ref.scope} ${live} AND ${order} < ${ref.order})`
      : sql`(SELECT MIN(${order}) FROM ${table} WHERE ${scope} = ${ref.scope} ${live} AND ${order} > ${ref.order})`;
  }

  private async neighbor(
    ref: OrderedRow,
    side: 'before' | 'after'
  ): Promise<number | null> {
    const row = await this.db.get<{value: number | null}>(
      sql`SELECT ${this.neighborRank(ref, side)} AS value`
    );
    return row?.value ?? null;
  }

  /** `row` as it is now: not found once it is out of the order. */
  private async reload(row: OrderedRow): Promise<OrderedRow> {
    const {table, id, order, scope, owner, ranked} = this.spec;
    const ownerColumn = owner === undefined ? sql`` : sql`, ${owner} AS owner`;
    const live = ranked === undefined ? sql`` : sql`AND ${ranked}`;
    const fresh = await this.db.get<OrderedRow>(
      sql`SELECT ${id} AS id, ${order} AS "order", ${scope} AS scope ${ownerColumn} FROM ${table} WHERE ${id} = ${row.id} ${live}`
    );
    if (fresh === undefined) {
      throw notFound('Not found.');
    }
    return fresh;
  }
}
