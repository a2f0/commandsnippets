/**
 * Staff changes to an account's status through the admin API
 * (`src/resources/admin.ts`): deactivating, reactivating, and marking for
 * deletion.
 */
import type {AdminAuditAction} from '@commandsnippets/api-shared';
import {and, eq, exists, isNull, sql} from 'drizzle-orm';
import type {BatchItem} from 'drizzle-orm/batch';
import type {Db} from '../db/client';
import {adminAuditLog, tokens, type User, users} from '../db/schema';
import {now} from '../lib/clock';

export interface AccountStatus {
  active: boolean;
  marked: boolean;
}

/**
 * Move `target`, as read, to `next`, recording each change in the audit log
 * as done by `staff`. Deactivating or marking for deletion also deletes the
 * account's token (one per user, shared by all of their browsers), so every
 * open session ends now, not at cookie expiry.
 *
 * Every statement applies only while the account is still as read, in one
 * batch (a transaction), so a change that raced this one (a mark while this
 * reactivates, say) is never overwritten, even one since undone: nothing
 * changes, and this returns false.
 */
export async function changeAccountStatus(
  db: Db,
  staff: User,
  target: User,
  next: AccountStatus
): Promise<boolean> {
  const wasMarked = target.date_marked_for_deletion !== null;
  const marking = next.marked && !wasMarked;
  const timestamp = now();
  // Every status change advances date_updated, so a change that came and
  // went (a mark, then an unmark) still counts.
  const asRead = and(
    eq(users.id, target.id),
    eq(users.date_updated, target.date_updated),
    eq(users.is_active, target.is_active),
    target.date_marked_for_deletion === null
      ? isNull(users.date_marked_for_deletion)
      : eq(users.date_marked_for_deletion, target.date_marked_for_deletion)
  );
  const stillAsRead = exists(
    db.select({one: sql`1`}).from(users).where(asRead)
  );

  const actions: AdminAuditAction[] = [];
  if (next.marked !== wasMarked) {
    actions.push(
      marking ? 'mark_user_for_deletion' : 'unmark_user_for_deletion'
    );
  }
  // Marking records only the mark: it implies the deactivation.
  if (next.active !== target.is_active && !marking) {
    actions.push(next.active ? 'activate_user' : 'deactivate_user');
  }
  // One row per action, and none once the account has changed.
  const audit = (action: AdminAuditAction) =>
    db.insert(adminAuditLog).select(
      db
        .select({
          id: sql<number>`NULL`.as('id'),
          created: sql<string>`${timestamp}`.as('created'),
          action: sql<string>`${action}`.as('action'),
          actor_id: sql<number>`${staff.id}`.as('actor_id'),
          actor_username: sql<string>`${staff.username}`.as('actor_username'),
          target_user_id: sql<number>`${target.id}`.as('target_user_id'),
          target_username: sql<string>`${target.username}`.as(
            'target_username'
          ),
        })
        .from(users)
        .where(asRead)
    );

  const update = db
    .update(users)
    .set({
      is_active: next.active,
      date_marked_for_deletion: next.marked
        ? (target.date_marked_for_deletion ?? timestamp)
        : null,
      date_updated: timestamp,
    })
    .where(asRead)
    .returning({id: users.id});
  // The token and the audit rows go first, while the account is as read; the
  // update, last, is what moves it out of that state.
  const before: BatchItem<'sqlite'>[] = actions.map(audit);
  if (!next.active && (target.is_active || marking)) {
    before.unshift(
      db.delete(tokens).where(and(eq(tokens.user_id, target.id), stillAsRead))
    );
  }
  const results = await db.batch(endingWith(before, update));
  const updated = results.at(-1);
  return Array.isArray(updated) && updated.length > 0;
}

/** `items` then `last`, typed as the non-empty list `db.batch` takes. */
function endingWith<T>(items: T[], last: T): [T, ...T[]] {
  const [first, ...rest] = items;
  return first === undefined ? [last] : [first, ...rest, last];
}
