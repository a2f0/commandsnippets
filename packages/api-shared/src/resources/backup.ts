/**
 * A backup of a user's data (`GET /api/v1/user/backup`): every tag, entry,
 * tagging and reuse of theirs that is not deleted, each with the id the API
 * knows it by, which the taggings and reuses refer to. It is a file to keep,
 * not a JSON:API document: what a client saves, and what a restore
 * (`POST /api/v1/user/restore`) reads back into any account, which makes the
 * rows anew (with ids of their own). The counters and dates the API works
 * out from these rows (a tag's `entry_count` and `date_last_used`, an
 * entry's `tag_count`, `reused_count` and `reused_date`) are left out.
 */
import * as z from 'zod/mini';
import {
  countSchema,
  resourceIdSchema,
  timestampSchema,
} from '../jsonapi/response';

/** What every backup's `format` says it is. */
export const BACKUP_FORMAT = 'commandsnippets-backup';

/** The version of the format this package describes. */
export const BACKUP_VERSION = 1;

export const backupTagSchema = z.object({
  id: resourceIdSchema,
  name: z.string(),
  order: countSchema,
  is_public: z.boolean(),
  date_created: timestampSchema,
  date_updated: timestampSchema,
});

export const backupEntrySchema = z.object({
  id: resourceIdSchema,
  subject: z.string(),
  body: z.string(),
  is_public: z.boolean(),
  date_created: timestampSchema,
  date_updated: timestampSchema,
});

/** An entry in a tag, ranked within it (`TagTextEntryThroughModel`). */
export const backupTaggingSchema = z.object({
  id: resourceIdSchema,
  tag_id: resourceIdSchema,
  text_entry_id: resourceIdSchema,
  order: countSchema,
  date_created: timestampSchema,
  date_updated: timestampSchema,
});

/** A time an entry was reused (`TextEntryReused`). */
export const backupReuseSchema = z.object({
  id: resourceIdSchema,
  text_entry_id: resourceIdSchema,
  date_created: timestampSchema,
});

/**
 * The backup. Every tagging's tag and entry, and every reuse's entry, is in
 * it; tags are in the user's order, taggings in their tag's.
 */
export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  date_exported: timestampSchema,
  user: z.object({id: resourceIdSchema, username: z.string()}),
  tags: z.array(backupTagSchema),
  entries: z.array(backupEntrySchema),
  tags_entries: z.array(backupTaggingSchema),
  entry_reuses: z.array(backupReuseSchema),
});

/**
 * `POST /api/v1/user/restore`'s answer: when the restore was made (the
 * API's clock; client writes made before it are refused, so a client that
 * restores makes its next ones after it), and how many of each it made. Its
 * request body is a backup (`backupSchema`), which replaces all of the
 * requester's data.
 */
export const restoreResultSchema = z.object({
  date_restored: timestampSchema,
  tags: countSchema,
  entries: countSchema,
  tags_entries: countSchema,
  entry_reuses: countSchema,
});

export type BackupTag = z.output<typeof backupTagSchema>;
export type BackupEntry = z.output<typeof backupEntrySchema>;
export type BackupTagging = z.output<typeof backupTaggingSchema>;
export type BackupReuse = z.output<typeof backupReuseSchema>;
export type Backup = z.output<typeof backupSchema>;
export type RestoreResult = z.output<typeof restoreResultSchema>;
