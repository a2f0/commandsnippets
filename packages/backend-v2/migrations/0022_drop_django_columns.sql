-- The second half of removing the Django-era columns nothing uses (#124):
-- users_user.first_name and last_name (never set), text_entries_textentry.
-- reused_date (written by the reuse counter triggers, never read), and
-- authtoken_token.created (written, never read). Safe once every deployed
-- Worker is at or past 0.2.13, which no longer reads the first three; the
-- token column it still writes, so a token made between this migration and
-- the next deploy fails (a first login retried moments later succeeds).
-- DROP COLUMN edits each table in place; rebuilding users_user would
-- cascade-delete every user's data.
--
-- The reuse counters first, without the date.
DROP TRIGGER `entry_reuses_after_insert`;
--> statement-breakpoint
CREATE TRIGGER `entry_reuses_after_insert`
AFTER INSERT ON `text_entries_textentryreused`
BEGIN
  UPDATE `text_entries_textentry`
    SET `reused_count` = `reused_count` + 1
    WHERE `id` = NEW.`text_entry_id`;
END;
--> statement-breakpoint
DROP TRIGGER `entry_reuses_after_delete`;
--> statement-breakpoint
CREATE TRIGGER `entry_reuses_after_delete`
AFTER DELETE ON `text_entries_textentryreused`
BEGIN
  UPDATE `text_entries_textentry`
    SET `reused_count` = `reused_count` - 1
    WHERE `id` = OLD.`text_entry_id`;
END;
--> statement-breakpoint
ALTER TABLE `text_entries_textentry` DROP COLUMN `reused_date`;--> statement-breakpoint
ALTER TABLE `authtoken_token` DROP COLUMN `created`;--> statement-breakpoint
ALTER TABLE `users_user` DROP COLUMN `first_name`;--> statement-breakpoint
ALTER TABLE `users_user` DROP COLUMN `last_name`;
