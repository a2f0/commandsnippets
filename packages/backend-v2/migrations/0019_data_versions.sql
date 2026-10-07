-- Data versions (users_dataversion, resources/dataVersions.ts): every tag,
-- entry, tagging and reuse belongs to one of its user's versions, and only
-- the active one (users_user.active_version) is ever written. These triggers
-- hold that in the statement that writes, so a write that lands after a
-- restore or a switch (queued on a device that had not synced since) is
-- refused, never applied to a version that is no longer, or not yet, the
-- user's data. The API answers their `data_version_changed` as a 409.
--
-- Rows of a version that is being deleted (its users_dataversion row gone
-- first) and of a user being deleted (their users_user row gone, so the
-- active version reads as NULL) may change and go: the deletes' cascades
-- and counter triggers write them.

CREATE TRIGGER `tags_tag_version_insert`
BEFORE INSERT ON `tags_tag`
WHEN NEW.`version` IS NOT (SELECT `active_version` FROM `users_user` WHERE `id` = NEW.`user_id`)
BEGIN
  SELECT RAISE(ABORT, 'data_version_changed: written to a version that is not active');
END;
--> statement-breakpoint
CREATE TRIGGER `tags_tag_version_update`
BEFORE UPDATE ON `tags_tag`
WHEN NEW.`version` IS NOT OLD.`version`
  OR (OLD.`version` <> (SELECT `active_version` FROM `users_user` WHERE `id` = OLD.`user_id`) AND EXISTS (SELECT 1 FROM `users_dataversion` WHERE `user_id` = OLD.`user_id` AND `version` = OLD.`version`))
BEGIN
  SELECT RAISE(ABORT, 'data_version_changed: written to a version that is not active');
END;
--> statement-breakpoint
CREATE TRIGGER `tags_tag_version_delete`
BEFORE DELETE ON `tags_tag`
WHEN OLD.`version` <> (SELECT `active_version` FROM `users_user` WHERE `id` = OLD.`user_id`) AND EXISTS (SELECT 1 FROM `users_dataversion` WHERE `user_id` = OLD.`user_id` AND `version` = OLD.`version`)
BEGIN
  SELECT RAISE(ABORT, 'data_version_changed: written to a version that is not active');
END;
--> statement-breakpoint
CREATE TRIGGER `text_entries_textentry_version_insert`
BEFORE INSERT ON `text_entries_textentry`
WHEN NEW.`version` IS NOT (SELECT `active_version` FROM `users_user` WHERE `id` = NEW.`user_id`)
BEGIN
  SELECT RAISE(ABORT, 'data_version_changed: written to a version that is not active');
END;
--> statement-breakpoint
CREATE TRIGGER `text_entries_textentry_version_update`
BEFORE UPDATE ON `text_entries_textentry`
WHEN NEW.`version` IS NOT OLD.`version`
  OR (OLD.`version` <> (SELECT `active_version` FROM `users_user` WHERE `id` = OLD.`user_id`) AND EXISTS (SELECT 1 FROM `users_dataversion` WHERE `user_id` = OLD.`user_id` AND `version` = OLD.`version`))
BEGIN
  SELECT RAISE(ABORT, 'data_version_changed: written to a version that is not active');
END;
--> statement-breakpoint
CREATE TRIGGER `text_entries_textentry_version_delete`
BEFORE DELETE ON `text_entries_textentry`
WHEN OLD.`version` <> (SELECT `active_version` FROM `users_user` WHERE `id` = OLD.`user_id`) AND EXISTS (SELECT 1 FROM `users_dataversion` WHERE `user_id` = OLD.`user_id` AND `version` = OLD.`version`)
BEGIN
  SELECT RAISE(ABORT, 'data_version_changed: written to a version that is not active');
END;
--> statement-breakpoint
CREATE TRIGGER `tags_tagtextentrythroughmodel_version_insert`
BEFORE INSERT ON `tags_tagtextentrythroughmodel`
WHEN NEW.`version` IS NOT (SELECT `active_version` FROM `users_user` WHERE `id` = NEW.`user_id`)
BEGIN
  SELECT RAISE(ABORT, 'data_version_changed: written to a version that is not active');
END;
--> statement-breakpoint
CREATE TRIGGER `tags_tagtextentrythroughmodel_version_update`
BEFORE UPDATE ON `tags_tagtextentrythroughmodel`
WHEN NEW.`version` IS NOT OLD.`version`
  OR (OLD.`version` <> (SELECT `active_version` FROM `users_user` WHERE `id` = OLD.`user_id`) AND EXISTS (SELECT 1 FROM `users_dataversion` WHERE `user_id` = OLD.`user_id` AND `version` = OLD.`version`))
BEGIN
  SELECT RAISE(ABORT, 'data_version_changed: written to a version that is not active');
END;
--> statement-breakpoint
CREATE TRIGGER `tags_tagtextentrythroughmodel_version_delete`
BEFORE DELETE ON `tags_tagtextentrythroughmodel`
WHEN OLD.`version` <> (SELECT `active_version` FROM `users_user` WHERE `id` = OLD.`user_id`) AND EXISTS (SELECT 1 FROM `users_dataversion` WHERE `user_id` = OLD.`user_id` AND `version` = OLD.`version`)
BEGIN
  SELECT RAISE(ABORT, 'data_version_changed: written to a version that is not active');
END;
--> statement-breakpoint
CREATE TRIGGER `text_entries_textentryreused_version_insert`
BEFORE INSERT ON `text_entries_textentryreused`
WHEN NEW.`version` IS NOT (SELECT `active_version` FROM `users_user` WHERE `id` = NEW.`user_id`)
BEGIN
  SELECT RAISE(ABORT, 'data_version_changed: written to a version that is not active');
END;
--> statement-breakpoint
CREATE TRIGGER `text_entries_textentryreused_version_update`
BEFORE UPDATE ON `text_entries_textentryreused`
WHEN NEW.`version` IS NOT OLD.`version`
  OR (OLD.`version` <> (SELECT `active_version` FROM `users_user` WHERE `id` = OLD.`user_id`) AND EXISTS (SELECT 1 FROM `users_dataversion` WHERE `user_id` = OLD.`user_id` AND `version` = OLD.`version`))
BEGIN
  SELECT RAISE(ABORT, 'data_version_changed: written to a version that is not active');
END;
--> statement-breakpoint
CREATE TRIGGER `text_entries_textentryreused_version_delete`
BEFORE DELETE ON `text_entries_textentryreused`
WHEN OLD.`version` <> (SELECT `active_version` FROM `users_user` WHERE `id` = OLD.`user_id`) AND EXISTS (SELECT 1 FROM `users_dataversion` WHERE `user_id` = OLD.`user_id` AND `version` = OLD.`version`)
BEGIN
  SELECT RAISE(ABORT, 'data_version_changed: written to a version that is not active');
END;
--> statement-breakpoint
-- A tagging is of its tag's version and its entry's; a reuse, of its
-- entry's: a client naming rows of an older version is refused. (Rows that
-- do not exist are the foreign keys' to refuse.)
CREATE TRIGGER `tags_tagtextentrythroughmodel_version_rows`
BEFORE INSERT ON `tags_tagtextentrythroughmodel`
WHEN NEW.`version` <> (SELECT `version` FROM `tags_tag` WHERE `id` = NEW.`tag_id`)
  OR NEW.`version` <> (SELECT `version` FROM `text_entries_textentry` WHERE `id` = NEW.`text_entry_id`)
BEGIN
  SELECT RAISE(ABORT, 'data_version_changed: a tagging of rows of another version');
END;
--> statement-breakpoint
CREATE TRIGGER `text_entries_textentryreused_version_rows`
BEFORE INSERT ON `text_entries_textentryreused`
WHEN NEW.`version` <> (SELECT `version` FROM `text_entries_textentry` WHERE `id` = NEW.`text_entry_id`)
BEGIN
  SELECT RAISE(ABORT, 'data_version_changed: a reuse of an entry of another version');
END;
--> statement-breakpoint
-- The active version is one the user has, the version numbers given out
-- only grow, and the active version is never deleted.
CREATE TRIGGER `users_user_active_version`
BEFORE UPDATE OF `active_version` ON `users_user`
WHEN NOT EXISTS (SELECT 1 FROM `users_dataversion` WHERE `user_id` = NEW.`id` AND `version` = NEW.`active_version`)
BEGIN
  SELECT RAISE(ABORT, 'data_version_missing: no such data version');
END;
--> statement-breakpoint
CREATE TRIGGER `users_user_last_version`
BEFORE UPDATE OF `last_version` ON `users_user`
WHEN NEW.`last_version` < OLD.`last_version`
BEGIN
  SELECT RAISE(ABORT, 'data_version_reused: version numbers only grow');
END;
--> statement-breakpoint
CREATE TRIGGER `users_dataversion_delete`
BEFORE DELETE ON `users_dataversion`
WHEN OLD.`version` = (SELECT `active_version` FROM `users_user` WHERE `id` = OLD.`user_id`)
BEGIN
  SELECT RAISE(ABORT, 'data_version_active: the active version cannot be deleted');
END;
--> statement-breakpoint
-- Every account starts with version 1: the ones there are, and each new one.
INSERT INTO `users_dataversion` (`user_id`, `version`, `date_created`, `origin`)
SELECT `id`, 1, `date_joined`, 'initial' FROM `users_user`;
--> statement-breakpoint
CREATE TRIGGER `users_user_initial_version`
AFTER INSERT ON `users_user`
BEGIN
  INSERT INTO `users_dataversion` (`user_id`, `version`, `date_created`, `origin`)
  VALUES (NEW.`id`, 1, NEW.`date_joined`, 'initial');
END;
