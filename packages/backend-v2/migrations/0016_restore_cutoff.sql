-- A client write made before the user's last restore (users_user.date_restored,
-- resources/restore.ts) is refused in the statement that makes it, so none
-- can land after a restore that commits while it is on its way. Every create,
-- edit and delete stamps the row's client_updated with when the write was
-- made (resources/lww.ts; `<time>` or `<time>|<write id>`, which compare by
-- their fixed-width time): one older than the cutoff aborts with
-- `data_restored`, which the API answers as a 400. That includes a write
-- that sets the time a row already has (a retry naming the write that last
-- wrote it): rows deleted before a restore keep their time. Rows written with
-- no client time (imports) and writes that leave client_updated alone
-- (reorders, revisions, counters) are not checked. The restore writes its own
-- rows at the cutoff itself, which is not older.

CREATE TRIGGER `tags_tag_restore_cutoff_insert`
BEFORE INSERT ON `tags_tag`
WHEN NEW.`client_updated` < (SELECT `date_restored` FROM `users_user` WHERE `id` = NEW.`user_id`)
BEGIN
  SELECT RAISE(ABORT, 'data_restored: made before the data was restored');
END;
--> statement-breakpoint
CREATE TRIGGER `tags_tag_restore_cutoff_update`
BEFORE UPDATE OF `client_updated` ON `tags_tag`
WHEN NEW.`client_updated` < (SELECT `date_restored` FROM `users_user` WHERE `id` = NEW.`user_id`)
BEGIN
  SELECT RAISE(ABORT, 'data_restored: made before the data was restored');
END;
--> statement-breakpoint
CREATE TRIGGER `text_entries_textentry_restore_cutoff_insert`
BEFORE INSERT ON `text_entries_textentry`
WHEN NEW.`client_updated` < (SELECT `date_restored` FROM `users_user` WHERE `id` = NEW.`user_id`)
BEGIN
  SELECT RAISE(ABORT, 'data_restored: made before the data was restored');
END;
--> statement-breakpoint
CREATE TRIGGER `text_entries_textentry_restore_cutoff_update`
BEFORE UPDATE OF `client_updated` ON `text_entries_textentry`
WHEN NEW.`client_updated` < (SELECT `date_restored` FROM `users_user` WHERE `id` = NEW.`user_id`)
BEGIN
  SELECT RAISE(ABORT, 'data_restored: made before the data was restored');
END;
--> statement-breakpoint
CREATE TRIGGER `tags_tagtextentrythroughmodel_restore_cutoff_insert`
BEFORE INSERT ON `tags_tagtextentrythroughmodel`
WHEN NEW.`client_updated` < (SELECT `date_restored` FROM `users_user` WHERE `id` = NEW.`user_id`)
BEGIN
  SELECT RAISE(ABORT, 'data_restored: made before the data was restored');
END;
--> statement-breakpoint
CREATE TRIGGER `tags_tagtextentrythroughmodel_restore_cutoff_update`
BEFORE UPDATE OF `client_updated` ON `tags_tagtextentrythroughmodel`
WHEN NEW.`client_updated` < (SELECT `date_restored` FROM `users_user` WHERE `id` = NEW.`user_id`)
BEGIN
  SELECT RAISE(ABORT, 'data_restored: made before the data was restored');
END;
