-- Data versions (0019_data_versions.sql) replace the restore cutoff: a
-- restore makes a new version instead of deleting rows, and writes are
-- refused by version rather than by when they were made.
-- users_user.date_restored, which they read, stays until no deployed Worker
-- reads it (migrations apply before the Worker that no longer does is
-- deployed).
DROP TRIGGER `tags_tag_restore_cutoff_insert`;
--> statement-breakpoint
DROP TRIGGER `tags_tag_restore_cutoff_update`;
--> statement-breakpoint
DROP TRIGGER `text_entries_textentry_restore_cutoff_insert`;
--> statement-breakpoint
DROP TRIGGER `text_entries_textentry_restore_cutoff_update`;
--> statement-breakpoint
DROP TRIGGER `tags_tagtextentrythroughmodel_restore_cutoff_insert`;
--> statement-breakpoint
DROP TRIGGER `tags_tagtextentrythroughmodel_restore_cutoff_update`;
