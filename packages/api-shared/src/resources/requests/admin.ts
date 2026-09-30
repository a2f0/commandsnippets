/**
 * The admin API's requests (`/api/v1/admin`). Neither collection has
 * relationships, so both refuse `include`.
 */
import * as z from 'zod/mini';
import {booleanField} from '../../fields';
import {booleanFieldFilter, pkFilter, textFilter} from '../../filters';
import {fail} from '../../issues';
import {noFieldsSchema, updateDocumentSchema} from '../../jsonapi/request';
import {CODES, MESSAGES} from '../../messages';
import {type ListParams, listQuerySchema} from '../../query';
import {ADMIN_USER} from '../types';

// Users

const writableSchema = z.partial(
  z.object({is_active: booleanField(), marked_for_deletion: booleanField()})
);

/**
 * PATCH/PUT: only `is_active` and `marked_for_deletion` can change. Any other
 * attribute is refused (the first one, as `read_only`) rather than ignored.
 * `marked_for_deletion: true` also deactivates the account.
 */
export const adminUserUpdateAttributesSchema = z.pipe(
  z.pipe(
    // A plain object first, so anything else fails validation instead of
    // throwing below (the request envelope already turns non-objects into
    // {}). Not z.record: it drops a `__proto__` key, which must be refused.
    z.custom<Record<string, unknown>>(
      value =>
        typeof value === 'object' && value !== null && !Array.isArray(value)
    ),
    z.transform((attributes: Record<string, unknown>, ctx) => {
      const readOnly = Object.keys(attributes).find(
        name => !Object.hasOwn(writableSchema.shape, name)
      );
      return readOnly === undefined
        ? attributes
        : fail(ctx, MESSAGES.readOnly, {code: CODES.readOnly}, [readOnly]);
    })
  ),
  writableSchema
);

export const adminUserUpdateDocumentSchema = updateDocumentSchema(ADMIN_USER, {
  attributes: adminUserUpdateAttributesSchema,
  relationships: noFieldsSchema,
});

export type AdminUserUpdateAttributes = z.output<
  typeof adminUserUpdateAttributesSchema
>;
export type AdminUserUpdateDocument = z.output<
  typeof adminUserUpdateDocumentSchema
>;

export const ADMIN_USER_SORT_FIELDS = [
  'username',
  'email',
  'date_joined',
  'last_login',
  'last_active',
  'login_count',
  'entry_count',
  'tag_count',
] as const;

/**
 * The collection's query, which `adminUserListQuerySchema` validates and
 * `AdminUserListParams` types. `filter[search]`: a case-insensitive
 * substring of the username or email; `filter[username]`: exactly one
 * username (how the web app finds the user whose data it shows).
 */
const adminUserListQuery = {
  filters: {
    is_active: booleanFieldFilter,
    is_staff: booleanFieldFilter,
    username: textFilter,
  },
  sort: ADMIN_USER_SORT_FIELDS,
  search: 'supported',
  include: 'refused',
  cursor: 'refused',
} as const;

export const adminUserListQuerySchema = listQuerySchema(adminUserListQuery);

export type AdminUserSortField = (typeof ADMIN_USER_SORT_FIELDS)[number];
export type AdminUserListQuery = z.output<typeof adminUserListQuerySchema>;
/** `GET /api/v1/admin/users`'s query parameters, as a client sends them. */
export type AdminUserListParams = ListParams<typeof adminUserListQuery>;

// The audit log

/**
 * The collection's query, which `adminAuditLogListQuerySchema` validates and
 * `AdminAuditLogListParams` types. Newest first, always: nothing is
 * sortable, and there is no search.
 */
const adminAuditLogListQuery = {
  filters: {target_user_id: pkFilter},
  sort: [],
  search: 'refused',
  include: 'refused',
  cursor: 'refused',
} as const;

export const adminAuditLogListQuerySchema = listQuerySchema(
  adminAuditLogListQuery
);

export type AdminAuditLogListQuery = z.output<
  typeof adminAuditLogListQuerySchema
>;
/** `GET /api/v1/admin/audit_log`'s query parameters, as a client sends them. */
export type AdminAuditLogListParams = ListParams<typeof adminAuditLogListQuery>;
