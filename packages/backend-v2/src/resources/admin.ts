/**
 * The admin API, for staff (`users.is_staff`) only: list and inspect users,
 * deactivate or reactivate accounts, and read the audit log of those changes.
 * Nothing here can grant staff; that stays a database change.
 */
import {and, asc, count, desc, eq, type SQL, sql} from 'drizzle-orm';
import {type Context, Hono} from 'hono';
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
import {fieldError, notFound, queryError} from '../lib/errors';
import {
  document,
  type FilterSpec,
  type ListQuery,
  listDocument,
  type OrderingSpec,
  paginate,
  parseListQuery,
  parseResource,
  type ResourceObject,
} from '../lib/jsonapi';
import {booleanField, parseBoolean, validateOrThrow} from '../lib/validation';
import {icontains} from './filters';
import {ADMIN_AUDIT_LOG_ENTRY, ADMIN_USER} from './resourceTypes';
import {jsonApi} from './responses';
import {parseId} from './viewset';

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
      login_count: row.login_count,
      date_updated: isoformat(row.date_updated),
      entry_count: row.entry_count,
      tag_count: row.tag_count,
    },
  };
}

const booleanFilter =
  (column: typeof users.is_active | typeof users.is_staff) =>
  (value: string): SQL => {
    const parsed = parseBoolean(value);
    if (parsed === null) {
      throw queryError('Must be a valid boolean.');
    }
    return eq(column, parsed);
  };

const USER_FILTERS: FilterSpec = {
  is_active: booleanFilter(users.is_active),
  is_staff: booleanFilter(users.is_staff),
};

const USER_ORDERING: OrderingSpec = {
  username: sql`${users.username} COLLATE NOCASE`,
  email: sql`${users.email} COLLATE NOCASE`,
  date_joined: sql`${users.date_joined}`,
  last_login: sql`${users.last_login}`,
  login_count: sql`${users.login_count}`,
  entry_count: entryCount,
  tag_count: tagCount,
};

/** `filter[search]`: a case-insensitive substring of the username or email. */
function userSearch(term: string): SQL {
  return sql`(${icontains(users.username, term)} OR ${icontains(users.email, term)})`;
}

function listQuery(
  c: Context<AppEnv>,
  filters: FilterSpec,
  ordering: OrderingSpec
): {url: URL; query: ListQuery} {
  const url = new URL(c.req.url);
  const query = parseListQuery(url, filters, ordering);
  if (query.include !== null) {
    throw queryError('include is not supported here.');
  }
  return {url, query};
}

adminRoutes.get('/users', async c => {
  const db = c.get('db');
  const {url, query} = listQuery(c, USER_FILTERS, USER_ORDERING);
  const conditions = [...query.filters];
  if (query.search !== null && query.search !== '') {
    conditions.push(userSearch(query.search));
  }
  const where = and(...conditions);
  const [total] = await db.select({value: count()}).from(users).where(where);
  const pagination = paginate(url, query, total?.value ?? 0);
  const rows = await selectUsers(db)
    .where(where)
    .orderBy(...(query.orderBy ?? [asc(users.date_joined)]), asc(users.id))
    .limit(query.pageSize)
    .offset(pagination.offset);
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

/** Only `is_active` can be changed; other attributes are rejected, not ignored. */
const WRITABLE = new Set(['is_active']);

adminRoutes.on(['PATCH', 'PUT'], '/users/:id', async c => {
  const staff = requireStaff(c);
  const db = c.get('db');
  const target = await getUser(db, c.req.param('id'));
  const {attributes} = await parseResource(c.req.raw, {
    type: ADMIN_USER,
    id: String(target.id),
  });
  const readOnly = Object.keys(attributes).find(name => !WRITABLE.has(name));
  if (readOnly !== undefined) {
    throw fieldError(readOnly, 'This field cannot be changed.', 'read_only');
  }
  const {is_active: isActive} = validateOrThrow<{is_active?: boolean}>(
    {is_active: booleanField()},
    attributes,
    {partial: true}
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
    action: isActive ? 'activate_user' : 'deactivate_user',
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

const AUDIT_FILTERS: FilterSpec = {
  target_user_id: value => {
    if (!/^\d+$/.test(value)) {
      throw queryError('Must be a valid integer.');
    }
    return eq(adminAuditLog.target_user_id, Number(value));
  },
};

/** Newest first. */
adminRoutes.get('/audit_log', async c => {
  const db = c.get('db');
  const {url, query} = listQuery(c, AUDIT_FILTERS, {});
  if (query.search !== null) {
    throw queryError('filter[search] is not supported here.');
  }
  const where = and(...query.filters);
  const [total] = await db
    .select({value: count()})
    .from(adminAuditLog)
    .where(where);
  const pagination = paginate(url, query, total?.value ?? 0);
  const rows = await db
    .select()
    .from(adminAuditLog)
    .where(where)
    .orderBy(desc(adminAuditLog.created), desc(adminAuditLog.id))
    .limit(query.pageSize)
    .offset(pagination.offset);
  return jsonApi(c, listDocument(rows.map(renderAuditEntry), [], pagination));
});
