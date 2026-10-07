/**
 * `DataVersion`: one version of a user's data (`/api/v1/user/data_versions`).
 * Every tag, entry, tagging and reuse belongs to one; the user's reads and
 * writes are of the active one (`User`'s `data_version`). Version 1 is the
 * data an account starts with; a restore makes the next, and makes it
 * active, keeping the one before as it was. A version that is not active
 * never changes: it can be made active again, exported, or deleted. Numbers
 * are never reused, so a client's copy of one is never taken for another's.
 */
import * as z from 'zod/mini';
import {
  countSchema,
  documentSchema,
  resourceSchema,
  timestampSchema,
  versionSchema,
} from '../jsonapi/response';
import {DATA_VERSION} from './types';

/** How a version was made: the account's first, or a restore of a backup. */
export const DATA_VERSION_ORIGINS = ['initial', 'restore'] as const;

export const dataVersionAttributesSchema = z.object({
  version: versionSchema,
  date_created: timestampSchema,
  active: z.boolean(),
  origin: z.enum(DATA_VERSION_ORIGINS),
  /** A restore's backup: whose data it was, and when it was exported. */
  backup_username: z.nullable(z.string()),
  backup_exported: z.nullable(timestampSchema),
  /** Live (not deleted) tags and entries. */
  tag_count: countSchema,
  entry_count: countSchema,
});

/** Its id is its version number. */
export const dataVersionSchema = resourceSchema(
  DATA_VERSION,
  dataVersionAttributesSchema
);

/** `POST /api/v1/user/data_versions/:version/activate`. */
export const dataVersionDocumentSchema = documentSchema(
  dataVersionSchema,
  z.never()
);

/** `GET /api/v1/user/data_versions`: every version, newest first. */
export const dataVersionListDocumentSchema = z.object({
  data: z.array(dataVersionSchema),
});

export type DataVersionAttributes = z.output<
  typeof dataVersionAttributesSchema
>;
export type DataVersion = z.output<typeof dataVersionSchema>;
export type DataVersionDocument = z.output<typeof dataVersionDocumentSchema>;
export type DataVersionListDocument = z.output<
  typeof dataVersionListDocumentSchema
>;
