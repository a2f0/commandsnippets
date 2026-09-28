/**
 * The staff-only admin API (`/api/v1/admin`): `AdminUser` accounts and the
 * `AdminAuditLogEntry` log of changes to them. Their requests are in
 * `requests/admin.ts`.
 */
import * as z from 'zod/mini';
import {
  countSchema,
  resourceIdSchema,
  resourceSchema,
  timestampSchema,
} from '../jsonapi/response';
import {ADMIN_AUDIT_LOG_ENTRY, ADMIN_USER} from './types';

// Users

export const adminUserAttributesSchema = z.object({
  username: z.string(),
  email: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  is_staff: z.boolean(),
  is_active: z.boolean(),
  date_joined: timestampSchema,
  last_login: z.nullable(timestampSchema),
  /** The latest authenticated request or login; null if neither is on record. */
  last_active: z.nullable(timestampSchema),
  login_count: countSchema,
  date_updated: timestampSchema,
  /** Live (not deleted) entries and tags. */
  entry_count: countSchema,
  tag_count: countSchema,
});

export const adminUserSchema = resourceSchema(
  ADMIN_USER,
  adminUserAttributesSchema
);

export type AdminUserAttributes = z.output<typeof adminUserAttributesSchema>;
export type AdminUser = z.output<typeof adminUserSchema>;

// The audit log

export const ADMIN_AUDIT_ACTIONS = [
  'activate_user',
  'deactivate_user',
] as const;

export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

/**
 * Usernames are copied in, so an entry still reads after its users are
 * deleted (their ids are then null).
 */
export const adminAuditLogEntryAttributesSchema = z.object({
  created: timestampSchema,
  action: z.enum(ADMIN_AUDIT_ACTIONS),
  actor_id: z.nullable(resourceIdSchema),
  actor_username: z.string(),
  target_user_id: z.nullable(resourceIdSchema),
  target_username: z.string(),
});

export const adminAuditLogEntrySchema = resourceSchema(
  ADMIN_AUDIT_LOG_ENTRY,
  adminAuditLogEntryAttributesSchema
);

export type AdminAuditLogEntryAttributes = z.output<
  typeof adminAuditLogEntryAttributesSchema
>;
export type AdminAuditLogEntry = z.output<typeof adminAuditLogEntrySchema>;
