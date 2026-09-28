/**
 * The admin API's requests (`/api/v1/admin`). Neither collection has
 * relationships, so both refuse `include`.
 */
import {z} from 'zod';
import {booleanField} from '../../fields';
import {booleanFieldFilter, pkFilter} from '../../filters';
import {fail} from '../../issues';
import {noFieldsSchema, updateDocumentSchema} from '../../jsonapi/request';
import {CODES, MESSAGES} from '../../messages';
import {listQuerySchema} from '../../query';
import {ADMIN_USER} from '../types';

// Users

const writableSchema = z.object({is_active: booleanField()}).partial();

/**
 * PATCH/PUT: only `is_active` can change. Any other attribute is refused
 * (the first one, as `read_only`) rather than ignored.
 */
export const adminUserUpdateAttributesSchema = z
  // A plain object first, so anything else fails validation instead of
  // throwing below (the request envelope already turns non-objects into {}).
  // Not z.record: it drops a `__proto__` key, which must be refused below.
  .custom<Record<string, unknown>>(
    value =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
  )
  .transform((attributes, ctx) => {
    const readOnly = Object.keys(attributes).find(
      name => !Object.hasOwn(writableSchema.shape, name)
    );
    return readOnly === undefined
      ? attributes
      : fail(ctx, MESSAGES.readOnly, {code: CODES.readOnly}, [readOnly]);
  })
  .pipe(writableSchema);

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
  'login_count',
  'entry_count',
  'tag_count',
] as const;

/** `filter[search]`: a case-insensitive substring of the username or email. */
export const adminUserListQuerySchema = listQuerySchema({
  filters: {is_active: booleanFieldFilter, is_staff: booleanFieldFilter},
  sort: ADMIN_USER_SORT_FIELDS,
  search: 'supported',
  include: 'refused',
});

export type AdminUserSortField = (typeof ADMIN_USER_SORT_FIELDS)[number];
export type AdminUserListQuery = z.output<typeof adminUserListQuerySchema>;

// The audit log

/** Newest first, always: nothing is sortable, and there is no search. */
export const adminAuditLogListQuerySchema = listQuerySchema({
  filters: {target_user_id: pkFilter},
  sort: [],
  search: 'refused',
  include: 'refused',
});

export type AdminAuditLogListQuery = z.output<
  typeof adminAuditLogListQuerySchema
>;
