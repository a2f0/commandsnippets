-- Data versions (0019_data_versions.sql) replace the restore cutoff: a
-- restore makes a new version instead of deleting rows, and writes are
-- refused by version rather than by when they were made. The cutoff's
-- triggers go first, since they read users_user.date_restored, which the
-- next migration drops.
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
