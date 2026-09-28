/**
 * Each endpoint's response documents. `included` can hold any resource an
 * include path reaches, so documents of the user's own resources share one
 * union (narrow it by `type`).
 */
import {z} from 'zod';
import {documentSchema, listDocumentSchema} from '../jsonapi/response';
import {adminAuditLogEntrySchema, adminUserSchema} from './admin';
import {tagSchema} from './tag';
import {tagTextEntrySchema} from './tagTextEntry';
import {textEntrySchema} from './textEntry';
import {textEntryReusedSchema} from './textEntryReused';
import {userSchema} from './user';

export const includedResourceSchema = z.discriminatedUnion('type', [
  userSchema,
  tagSchema,
  textEntrySchema,
  tagTextEntrySchema,
  textEntryReusedSchema,
]);

export type IncludedResource = z.output<typeof includedResourceSchema>;

/** Nothing can be included (the resource has no relationships). */
const none = z.never();

/** `GET /api/v1/user`. */
export const userDocumentSchema = documentSchema(userSchema, none);

/** `/api/v1/tags` (the default `include` is the owner). */
export const tagDocumentSchema = documentSchema(
  tagSchema,
  includedResourceSchema
);
export const tagListDocumentSchema = listDocumentSchema(
  tagSchema,
  includedResourceSchema
);

/**
 * `/api/v1/entries` (the default `include` is the owner, and each junction
 * with its tag).
 */
export const textEntryDocumentSchema = documentSchema(
  textEntrySchema,
  includedResourceSchema
);
export const textEntryListDocumentSchema = listDocumentSchema(
  textEntrySchema,
  includedResourceSchema
);

/** `POST /api/v1/tags_entries` (the default `include` is all three ends). */
export const tagTextEntryDocumentSchema = documentSchema(
  tagTextEntrySchema,
  includedResourceSchema
);

/** `/api/v1/entry_reuses` (nothing included by default). */
export const textEntryReusedDocumentSchema = documentSchema(
  textEntryReusedSchema,
  includedResourceSchema
);
export const textEntryReusedListDocumentSchema = listDocumentSchema(
  textEntryReusedSchema,
  includedResourceSchema
);

/** `/api/v1/admin/users`. */
export const adminUserDocumentSchema = documentSchema(adminUserSchema, none);
export const adminUserListDocumentSchema = listDocumentSchema(
  adminUserSchema,
  none
);

/** `/api/v1/admin/audit_log`. */
export const adminAuditLogListDocumentSchema = listDocumentSchema(
  adminAuditLogEntrySchema,
  none
);

export type UserDocument = z.output<typeof userDocumentSchema>;
export type TagDocument = z.output<typeof tagDocumentSchema>;
export type TagListDocument = z.output<typeof tagListDocumentSchema>;
export type TextEntryDocument = z.output<typeof textEntryDocumentSchema>;
export type TextEntryListDocument = z.output<
  typeof textEntryListDocumentSchema
>;
export type TagTextEntryDocument = z.output<typeof tagTextEntryDocumentSchema>;
export type TextEntryReusedDocument = z.output<
  typeof textEntryReusedDocumentSchema
>;
export type TextEntryReusedListDocument = z.output<
  typeof textEntryReusedListDocumentSchema
>;
export type AdminUserDocument = z.output<typeof adminUserDocumentSchema>;
export type AdminUserListDocument = z.output<
  typeof adminUserListDocumentSchema
>;
export type AdminAuditLogListDocument = z.output<
  typeof adminAuditLogListDocumentSchema
>;
