-- Invalidate public caches in the same transaction as each output change.
-- Entries disappearing from a filtered feed cannot deliver tombstones; a new
-- generation clears that owner's public rows and cursors before a full read.
CREATE TRIGGER `tags_tag_public_insert`
AFTER INSERT ON `tags_tag`
BEGIN
  UPDATE `users_user` SET `public_revision` = `public_revision` + 1 WHERE `id` = NEW.`user_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `tags_tag_public_delete`
AFTER DELETE ON `tags_tag`
BEGIN
  UPDATE `users_user` SET `public_revision` = `public_revision` + 1 WHERE `id` = OLD.`user_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `tags_tag_public_update`
AFTER UPDATE OF `date_updated`, `is_public`, `is_deleted` ON `tags_tag`
WHEN NEW.`date_updated` IS NOT OLD.`date_updated` OR NEW.`is_public` IS NOT OLD.`is_public` OR NEW.`is_deleted` IS NOT OLD.`is_deleted`
BEGIN
  UPDATE `users_user` SET `public_revision` = `public_revision` + 1 WHERE `id` = NEW.`user_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `text_entries_textentry_public_insert`
AFTER INSERT ON `text_entries_textentry`
BEGIN
  UPDATE `users_user` SET `public_revision` = `public_revision` + 1 WHERE `id` = NEW.`user_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `text_entries_textentry_public_delete`
AFTER DELETE ON `text_entries_textentry`
BEGIN
  UPDATE `users_user` SET `public_revision` = `public_revision` + 1 WHERE `id` = OLD.`user_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `text_entries_textentry_public_update`
AFTER UPDATE OF `date_updated`, `is_public`, `is_deleted` ON `text_entries_textentry`
WHEN NEW.`date_updated` IS NOT OLD.`date_updated` OR NEW.`is_public` IS NOT OLD.`is_public` OR NEW.`is_deleted` IS NOT OLD.`is_deleted`
BEGIN
  UPDATE `users_user` SET `public_revision` = `public_revision` + 1 WHERE `id` = NEW.`user_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `tags_tagtextentrythroughmodel_public_insert`
AFTER INSERT ON `tags_tagtextentrythroughmodel`
BEGIN
  UPDATE `users_user` SET `public_revision` = `public_revision` + 1 WHERE `id` = NEW.`user_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `tags_tagtextentrythroughmodel_public_delete`
AFTER DELETE ON `tags_tagtextentrythroughmodel`
BEGIN
  UPDATE `users_user` SET `public_revision` = `public_revision` + 1 WHERE `id` = OLD.`user_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `tags_tagtextentrythroughmodel_public_update`
AFTER UPDATE OF `date_updated`, `is_deleted`, `tag_id`, `text_entry_id` ON `tags_tagtextentrythroughmodel`
WHEN NEW.`date_updated` IS NOT OLD.`date_updated` OR NEW.`is_deleted` IS NOT OLD.`is_deleted` OR NEW.`tag_id` IS NOT OLD.`tag_id` OR NEW.`text_entry_id` IS NOT OLD.`text_entry_id`
BEGIN
  UPDATE `users_user` SET `public_revision` = `public_revision` + 1 WHERE `id` = NEW.`user_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `users_public_availability`
AFTER UPDATE OF `is_active`, `date_marked_for_deletion`, `username` ON `users_user`
WHEN NEW.`is_active` IS NOT OLD.`is_active` OR NEW.`date_marked_for_deletion` IS NOT OLD.`date_marked_for_deletion` OR NEW.`username` IS NOT OLD.`username`
BEGIN
  UPDATE `users_user` SET `public_revision` = `public_revision` + 1 WHERE `id` = NEW.`id`;
END;
