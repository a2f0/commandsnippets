/**
 * Tables mirror the Django models (and keep Django's table/column names) so
 * the Postgres import is a straight copy and existing ad-hoc SQL keeps working.
 *
 * Timestamps are stored as fixed-width naive UTC text with microseconds
 * (`YYYY-MM-DDTHH:MM:SS.ffffff`), which sorts lexicographically. See
 * `src/lib/clock.ts`.
 *
 * Postgres enforced varchar lengths; SQLite does not, so length CHECKs stand
 * in for them.
 */
import {sql} from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users_user',
  {
    id: integer('id').primaryKey({autoIncrement: true}),
    username: text('username').notNull().unique(),
    email: text('email').notNull().default(''),
    first_name: text('first_name').notNull().default(''),
    last_name: text('last_name').notNull().default(''),
    // Staff use the admin API (/api/v1/admin). Django's is_superuser is gone.
    is_staff: integer('is_staff', {mode: 'boolean'}).notNull().default(false),
    // Deactivated accounts cannot log in, and their tokens are not accepted.
    is_active: integer('is_active', {mode: 'boolean'}).notNull().default(true),
    last_login: text('last_login'),
    // The last authenticated request or login (src/services/tokens.ts);
    // accounts from before the column started at last_login. It does not
    // advance date_updated, which clients sync on.
    last_active: text('last_active'),
    date_joined: text('date_joined').notNull(),
    date_updated: text('date_updated').notNull(),
    login_count: integer('login_count').notNull().default(1),
    // When staff marked the account for deletion through the admin API, which
    // also deactivates it; NULL if it is not marked.
    date_marked_for_deletion: text('date_marked_for_deletion'),
  },
  table => [
    check('users_user_username_length', sql`length(${table.username}) <= 150`),
    check('users_user_email_length', sql`length(${table.email}) <= 254`),
    check('users_user_login_count_check', sql`${table.login_count} >= 0`),
    // Logins find accounts by email, so one non-empty email must map to one
    // account; this is also what makes concurrent first logins safe. Django
    // never enforced it (empty emails stay allowed, as they were).
    uniqueIndex('users_user_email_unique')
      .on(table.email)
      .where(sql`${table.email} != ''`),
  ]
);

export const tokens = sqliteTable(
  'authtoken_token',
  {
    key: text('key').primaryKey(),
    created: text('created').notNull(),
    user_id: integer('user_id')
      .notNull()
      .unique()
      .references(() => users.id, {onDelete: 'cascade'}),
  },
  table => [check('authtoken_token_key_length', sql`length(${table.key}) = 40`)]
);

/**
 * What staff did through the admin API. Usernames are copied in so the log
 * still reads after a user is deleted (the ids are then set to NULL).
 */
export const adminAuditLog = sqliteTable(
  'admin_audit_log',
  {
    id: integer('id').primaryKey({autoIncrement: true}),
    created: text('created').notNull(),
    action: text('action').notNull(),
    actor_id: integer('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    actor_username: text('actor_username').notNull(),
    target_user_id: integer('target_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    target_username: text('target_username').notNull(),
  },
  table => [
    index('admin_audit_log_created_idx').on(table.created),
    index('admin_audit_log_target_user_id_idx').on(table.target_user_id),
  ]
);

export const textEntries = sqliteTable(
  'text_entries_textentry',
  {
    id: integer('id').primaryKey({autoIncrement: true}),
    body: text('body').notNull(),
    subject: text('subject').notNull(),
    date_created: text('date_created').notNull(),
    date_updated: text('date_updated').notNull(),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    is_deleted: integer('is_deleted', {mode: 'boolean'})
      .notNull()
      .default(false),
    tag_count: integer('tag_count').notNull().default(0),
    reused_count: integer('reused_count').notNull().default(0),
    reused_date: text('reused_date'),
    // Folded copies of subject/body for Unicode-aware search (lib/search.ts).
    subject_folded: text('subject_folded').notNull().default(''),
    body_folded: text('body_folded').notNull().default(''),
    // When the last write a client made to the row was made (api-shared's
    // CLIENT_UPDATED_HEADER): a write older than it changes nothing (last
    // writer wins by edit time, resources/lww.ts). NULL counts as oldest.
    client_updated: text('client_updated'),
    // A queued create's client id: a retried create finds the entry it made.
    client_id: text('client_id'),
  },
  table => [
    check(
      'text_entries_textentry_body_length',
      sql`length(${table.body}) <= 1024`
    ),
    check(
      'text_entries_textentry_subject_length',
      sql`length(${table.subject}) <= 255`
    ),
    index('text_entries_textentry_user_id_idx').on(
      table.user_id,
      table.date_updated
    ),
    uniqueIndex('text_entries_textentry_client_id_unique')
      .on(table.user_id, table.client_id)
      .where(sql`${table.client_id} IS NOT NULL`),
  ]
);

export const tags = sqliteTable(
  'tags_tag',
  {
    id: integer('id').primaryKey({autoIncrement: true}),
    name: text('name').notNull(),
    date_created: text('date_created').notNull(),
    date_updated: text('date_updated').notNull(),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    entry_count: integer('entry_count').notNull().default(0),
    date_last_used: text('date_last_used'),
    order: integer('order').notNull(),
    is_deleted: integer('is_deleted', {mode: 'boolean'})
      .notNull()
      .default(false),
    // A client's last write (see text_entries_textentry.client_updated).
    client_updated: text('client_updated'),
    // The client id of the queued create that made the tag, which the API
    // renders: a client that syncs the tag before the create's answer arrives
    // knows it. (Retries find tags by `tags_tagclientid`, which holds every
    // create's.)
    client_id: text('client_id'),
  },
  table => [
    unique('One tag of same name per user').on(table.name, table.user_id),
    check('tags_tag_name_length', sql`length(${table.name}) <= 24`),
    check('tags_tag_order_check', sql`${table.order} >= 0`),
    index('tags_tag_user_order_idx').on(table.user_id, table.order),
    index('tags_tag_user_updated_idx').on(table.user_id, table.date_updated),
  ]
);

/**
 * The client id of every queued tag create, and the tag it was answered with
 * (the tag it made, or the user's of the name): a retried create finds that
 * tag by it, however it is named by then. Reserved in the batch of the write
 * the create is answered with, so a client id names one tag.
 */
export const tagClientIds = sqliteTable(
  'tags_tagclientid',
  {
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    client_id: text('client_id').notNull(),
    tag_id: integer('tag_id')
      .notNull()
      .references(() => tags.id, {onDelete: 'cascade'}),
  },
  table => [
    primaryKey({columns: [table.user_id, table.client_id]}),
    index('tags_tagclientid_tag_id_idx').on(table.tag_id),
  ]
);

/**
 * The writes the API counted as made now (naming no time, or one ahead of
 * its clock), by the id the client gave each (`Client-Write-Id`): when the
 * first attempt arrived, which every retry counts too, however late. Kept
 * as long as the user.
 */
export const clientWrites = sqliteTable(
  'sync_clientwrite',
  {
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    write_id: text('write_id').notNull(),
    made: text('made').notNull(),
    date_created: text('date_created').notNull(),
  },
  table => [primaryKey({columns: [table.user_id, table.write_id]})]
);

export const tagsEntries = sqliteTable(
  'tags_tagtextentrythroughmodel',
  {
    id: integer('id').primaryKey({autoIncrement: true}),
    order: integer('order').notNull(),
    tag_id: integer('tag_id')
      .notNull()
      .references(() => tags.id, {onDelete: 'cascade'}),
    text_entry_id: integer('text_entry_id')
      .notNull()
      .references(() => textEntries.id, {onDelete: 'cascade'}),
    date_created: text('date_created').notNull(),
    date_updated: text('date_updated').notNull(),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    // Untagging soft-deletes the junction, so a tag's junctions after a
    // cursor show the entries that left it (resources/tagsEntries.ts).
    is_deleted: integer('is_deleted', {mode: 'boolean'})
      .notNull()
      .default(false),
    // A client's last write (see text_entries_textentry.client_updated).
    client_updated: text('client_updated'),
  },
  table => [
    unique('tags_tagtextentrythroughmodel_tag_id_text_entry_id_uniq').on(
      table.tag_id,
      table.text_entry_id
    ),
    check(
      'tags_tagtextentrythroughmodel_order_check',
      sql`${table.order} >= 0`
    ),
    index('tags_tagtextentrythroughmodel_tag_order_idx').on(
      table.tag_id,
      table.order
    ),
    index('tags_tagtextentrythroughmodel_text_entry_id_idx').on(
      table.text_entry_id
    ),
    // The junction lists in revision order: a user's, and a tag's.
    index('tags_tagtextentrythroughmodel_user_updated_idx').on(
      table.user_id,
      table.date_updated
    ),
    index('tags_tagtextentrythroughmodel_tag_updated_idx').on(
      table.tag_id,
      table.date_updated
    ),
  ]
);

export const entryReuses = sqliteTable(
  'text_entries_textentryreused',
  {
    id: integer('id').primaryKey({autoIncrement: true}),
    date_created: text('date_created').notNull(),
    text_entry_id: integer('text_entry_id')
      .notNull()
      .references(() => textEntries.id, {onDelete: 'cascade'}),
    user_id: integer('user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
  },
  table => [
    index('text_entries_textentryreused_text_entry_id_idx').on(
      table.text_entry_id
    ),
    index('text_entries_textentryreused_user_id_idx').on(table.user_id),
  ]
);

export type User = typeof users.$inferSelect;
export type Token = typeof tokens.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type TagClientId = typeof tagClientIds.$inferSelect;
export type ClientWrite = typeof clientWrites.$inferSelect;
export type TextEntry = typeof textEntries.$inferSelect;
export type TagTextEntry = typeof tagsEntries.$inferSelect;
export type TextEntryReused = typeof entryReuses.$inferSelect;
export type AdminAuditLogEntry = typeof adminAuditLog.$inferSelect;
