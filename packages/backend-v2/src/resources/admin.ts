/**
 * The admin API, for staff (`users.is_staff`) only: list and inspect users,
 * read their data (read-only), deactivate or reactivate accounts, mark them
 * for deletion (or unmark them), and read the audit log of those changes.
 * Nothing here can grant staff; that stays a database change, and nothing
 * here writes a user's data: staff change only their own, through the same
 * owner-only routes as everyone.
 */
import {
  adminAuditLogListQuerySchema,
  adminUserListQuerySchema,
  adminUserUpdateAttributesSchema,
  CODES,
} from '@commandsnippets/api-shared';
import {and, asc, desc, eq, type SQL, sql} from 'drizzle-orm';
import {Hono} from 'hono';
import {requireStaff} from '../auth/permissions';
import type {Db} from '../db/client';
import {
  type AdminAuditLogEntry,
  adminAuditLog,
  type User,
  users,
} from '../db/schema';
import type {AppEnv} from '../env';
import {isoformat} from '../lib/clock';
import {ApiError, fieldError, notFound} from '../lib/errors';
import {
  document,
  listDocument,
  parseResource,
  type ResourceObject,
} from '../lib/jsonapi';
import {validateFields} from '../lib/validate';
import {changeAccountStatus} from '../services/accounts';
import {listEntries} from './entries';
import {icontains} from './filters';
import {ADMIN_AUDIT_LOG_ENTRY, ADMIN_USER} from './resourceTypes';
import {jsonApi} from './responses';
import {listTags} from './tags';
import {listTagEntries} from './tagsEntries';
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
 * Live (not soft-deleted) entries and tags of the active data version, per
 * user. Written out with table
 * names: drizzle leaves columns unqualified in a single-table select, so
 * `${users.id}` in here would bind to the counted table's own id.
 */
const entryCount = sql<number>`(SELECT COUNT(*) FROM text_entries_textentry AS e WHERE e.user_id = users_user.id AND e.version = users_user.active_version AND e.is_deleted = 0)`;
const tagCount = sql<number>`(SELECT COUNT(*) FROM tags_tag AS t WHERE t.user_id = users_user.id AND t.version = users_user.active_version AND t.is_deleted = 0)`;

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
      date_marked_for_deletion: isoformat(row.date_marked_for_deletion),
      entry_count: row.entry_count,
      tag_count: row.tag_count,
      data_version: row.active_version,
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
      username: value => eq(users.username, value),
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
  // Only `is_active` and `marked_for_deletion` can change; any other attribute
  // is refused.
  const {is_active: isActive, marked_for_deletion: markedForDeletion} =
    validateFields(adminUserUpdateAttributesSchema, attributes);
  const wasMarked = target.date_marked_for_deletion !== null;
  const marked = markedForDeletion ?? wasMarked;
  // An account marked for deletion is always deactivated.
  if (marked && isActive === true) {
    throw fieldError(
      'is_active',
      'An account marked for deletion cannot be reactivated.',
      'invalid'
    );
  }
  const active = marked ? false : (isActive ?? target.is_active);
  const marking = marked && !wasMarked;
  const deactivating = !active && target.is_active;
  if (marked === wasMarked && active === target.is_active) {
    return jsonApi(c, document(renderUser(target)));
  }
  if (target.id === staff.id && marking) {
    throw fieldError(
      'marked_for_deletion',
      'You cannot mark your own account for deletion.',
      'invalid'
    );
  }
  if (target.id === staff.id && deactivating) {
    throw fieldError(
      'is_active',
      'You cannot deactivate your own account.',
      'invalid'
    );
  }

  if (!(await changeAccountStatus(db, staff, target, {active, marked}))) {
    throw ApiError.of(
      409,
      'The account changed while it was being updated. Please retry.',
      CODES.orderingConflict
    );
  }
  return jsonApi(c, document(renderUser(await getUser(db, String(target.id)))));
});

// ---------------------------------------------------------------------------
// A user's data, read-only
// ---------------------------------------------------------------------------

// The same lists (queries, keyset pages, includes) as the user's own
// `/tags`, `/entries` and `/tags_entries`, scoped to them. Only GET is
// routed: any other method is a 404, and the owner-only routes refuse staff
// a write to anyone's data but their own.
adminRoutes.get('/users/:id/tags', async c =>
  listTags(c, await getUser(c.get('db'), c.req.param('id')))
);
adminRoutes.get('/users/:id/entries', async c =>
  listEntries(c, await getUser(c.get('db'), c.req.param('id')))
);
adminRoutes.get('/users/:id/tags_entries', async c =>
  listTagEntries(c, await getUser(c.get('db'), c.req.param('id')))
);

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
