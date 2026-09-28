/**
 * The admin API, for staff (`users.is_staff`) only: list and inspect users,
 * deactivate or reactivate accounts, and read the audit log of those changes.
 * Nothing here can grant staff; that stays a database change.
 */
import {
  type AdminAuditAction,
  adminAuditLogListQuerySchema,
  adminUserListQuerySchema,
  adminUserUpdateAttributesSchema,
} from '@commandsnippets/api-shared';
import {and, asc, desc, eq, type SQL, sql} from 'drizzle-orm';
import {Hono} from 'hono';
import {requireStaff} from '../auth/permissions';
import type {Db} from '../db/client';
import {
  type AdminAuditLogEntry,
  adminAuditLog,
  tokens,
  type User,
  users,
} from '../db/schema';
import type {AppEnv} from '../env';
import {isoformat, now} from '../lib/clock';
import {fieldError, notFound} from '../lib/errors';
import {
  document,
  listDocument,
  parseResource,
  type ResourceObject,
} from '../lib/jsonapi';
import {validateFields} from '../lib/validate';
import {icontains} from './filters';
import {ADMIN_AUDIT_LOG_ENTRY, ADMIN_USER} from './resourceTypes';
import {jsonApi} from './responses';
import {listPage, pageOrder, parseId} from './viewset';

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use('*', async (c, next) => {
  requireStaff(c);
  await next();
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/**
 * Live (not soft-deleted) entries and tags, per user. Written out with table
 * names: drizzle leaves columns unqualified in a single-table select, so
 * `${users.id}` in here would bind to the counted table's own id.
 */
const entryCount = sql<number>`(SELECT COUNT(*) FROM text_entries_textentry AS e WHERE e.user_id = users_user.id AND e.is_deleted = 0)`;
const tagCount = sql<number>`(SELECT COUNT(*) FROM tags_tag AS t WHERE t.user_id = users_user.id AND t.is_deleted = 0)`;

type AdminUserRow = User & {entry_count: number; tag_count: number};

const selectUsers = (db: Db) =>
  db
    .select({user: users, entry_count: entryCount, tag_count: tagCount})
    .from(users);

const toRow = (row: {
  user: User;
  entry_count: number;
  tag_count: number;
}): AdminUserRow => ({
  ...row.user,
  entry_count: row.entry_count,
  tag_count: row.tag_count,
});

function renderUser(row: AdminUserRow): ResourceObject {
  return {
    type: ADMIN_USER,
    id: String(row.id),
    attributes: {
      username: row.username,
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      is_staff: row.is_staff,
      is_active: row.is_active,
      date_joined: isoformat(row.date_joined),
      last_login: isoformat(row.last_login),
      last_active: isoformat(row.last_active),
      login_count: row.login_count,
      date_updated: isoformat(row.date_updated),
      entry_count: row.entry_count,
      tag_count: row.tag_count,
    },
  };
}

/** `filter[search]`: a case-insensitive substring of the username or email. */
function userSearch(term: string): SQL {
  return sql`(${icontains(users.username, term)} OR ${icontains(users.email, term)})`;
}

adminRoutes.get('/users', async c => {
  const db = c.get('db');
  const {rows, pagination} = await listPage(c, {
    query: adminUserListQuerySchema,
    filters: {
      is_active: value => eq(users.is_active, value),
      is_staff: value => eq(users.is_staff, value),
    },
    ordering: {
      username: sql`${users.username} COLLATE NOCASE`,
      email: sql`${users.email} COLLATE NOCASE`,
      date_joined: sql`${users.date_joined}`,
      last_login: sql`${users.last_login}`,
      last_active: sql`${users.last_active}`,
      login_count: sql`${users.login_count}`,
      entry_count: entryCount,
      tag_count: tagCount,
    },
    where: query => {
      const conditions = [...query.filters];
      if (query.search !== null && query.search !== '') {
        conditions.push(userSearch(query.search));
      }
      return and(...conditions);
    },
    table: users,
    fetch: ({query, where, limit, offset}) =>
      selectUsers(db)
        .where(where)
        .orderBy(...pageOrder(query, [asc(users.date_joined)], asc(users.id)))
        .limit(limit)
        .offset(offset),
  });
  return jsonApi(
    c,
    listDocument(
      rows.map(row => renderUser(toRow(row))),
      [],
      pagination
    )
  );
});

async function getUser(db: Db, id: string | undefined): Promise<AdminUserRow> {
  const [row] = await selectUsers(db).where(
    eq(users.id, parseId(id, ADMIN_USER))
  );
  if (row === undefined) {
    throw notFound(`No ${ADMIN_USER} matches the given query.`);
  }
  return toRow(row);
}

adminRoutes.get('/users/:id', async c =>
  jsonApi(
    c,
    document(renderUser(await getUser(c.get('db'), c.req.param('id'))))
  )
);

adminRoutes.on(['PATCH', 'PUT'], '/users/:id', async c => {
  const staff = requireStaff(c);
  const db = c.get('db');
  const target = await getUser(db, c.req.param('id'));
  const {attributes} = await parseResource(c.req.raw, {
    type: ADMIN_USER,
    id: String(target.id),
  });
  // Only `is_active` can change; any other attribute is refused.
  const {is_active: isActive} = validateFields(
    adminUserUpdateAttributesSchema,
    attributes
  );
  if (isActive === undefined || isActive === target.is_active) {
    return jsonApi(c, document(renderUser(target)));
  }
  if (!isActive && target.id === staff.id) {
    throw fieldError(
      'is_active',
      'You cannot deactivate your own account.',
      'invalid'
    );
  }

  const audit = db.insert(adminAuditLog).values({
    created: now(),
    action: (isActive
      ? 'activate_user'
      : 'deactivate_user') satisfies AdminAuditAction,
    actor_id: staff.id,
    actor_username: staff.username,
    target_user_id: target.id,
    target_username: target.username,
  });
  const update = db
    .update(users)
    .set({is_active: isActive, date_updated: now()})
    .where(eq(users.id, target.id));
  // Deactivating deletes the account's token (one per user, shared by all of
  // their browsers), so every open session ends now, not at cookie expiry.
  await (isActive
    ? db.batch([update, audit])
    : db.batch([
        update,
        db.delete(tokens).where(eq(tokens.user_id, target.id)),
        audit,
      ]));
  return jsonApi(c, document(renderUser(await getUser(db, String(target.id)))));
});

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

function renderAuditEntry(row: AdminAuditLogEntry): ResourceObject {
  return {
    type: ADMIN_AUDIT_LOG_ENTRY,
    id: String(row.id),
    attributes: {
      created: isoformat(row.created),
      action: row.action,
      actor_id: row.actor_id === null ? null : String(row.actor_id),
      actor_username: row.actor_username,
      target_user_id:
        row.target_user_id === null ? null : String(row.target_user_id),
      target_username: row.target_username,
    },
  };
}

/** Newest first, always: nothing is sortable. */
adminRoutes.get('/audit_log', async c => {
  const db = c.get('db');
  const {rows, pagination} = await listPage(c, {
    query: adminAuditLogListQuerySchema,
    filters: {
      target_user_id: value => eq(adminAuditLog.target_user_id, value),
    },
    ordering: {},
    where: query => and(...query.filters),
    table: adminAuditLog,
    fetch: ({where, limit, offset}) =>
      db
        .select()
        .from(adminAuditLog)
        .where(where)
        .orderBy(desc(adminAuditLog.created), desc(adminAuditLog.id))
        .limit(limit)
        .offset(offset),
  });
  return jsonApi(c, listDocument(rows.map(renderAuditEntry), [], pagination));
});
