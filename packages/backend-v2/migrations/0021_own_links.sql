-- A tagging belongs to its tag's user and its entry's, and a reuse to its
-- entry's: no row links one user's data to another's. The API never makes
-- one (resources/related.ts resolves only the requester's own rows); Django
-- never checked, and its import (since removed) could load them, but neither
-- staging nor production holds any. These triggers hold it in the statement
-- that writes. `<>` rather than IS NOT: a row that does not exist is the
-- foreign keys' to refuse.
CREATE TRIGGER `tags_tagtextentrythroughmodel_own_rows_insert`
BEFORE INSERT ON `tags_tagtextentrythroughmodel`
WHEN NEW.`user_id` <> (SELECT `user_id` FROM `tags_tag` WHERE `id` = NEW.`tag_id`)
  OR NEW.`user_id` <> (SELECT `user_id` FROM `text_entries_textentry` WHERE `id` = NEW.`text_entry_id`)
BEGIN
  SELECT RAISE(ABORT, 'cross_user_link: a tagging of another user''s rows');
END;
--> statement-breakpoint
CREATE TRIGGER `tags_tagtextentrythroughmodel_own_rows_update`
BEFORE UPDATE OF `user_id`, `tag_id`, `text_entry_id` ON `tags_tagtextentrythroughmodel`
WHEN NEW.`user_id` <> (SELECT `user_id` FROM `tags_tag` WHERE `id` = NEW.`tag_id`)
  OR NEW.`user_id` <> (SELECT `user_id` FROM `text_entries_textentry` WHERE `id` = NEW.`text_entry_id`)
BEGIN
  SELECT RAISE(ABORT, 'cross_user_link: a tagging of another user''s rows');
END;
--> statement-breakpoint
CREATE TRIGGER `text_entries_textentryreused_own_rows_insert`
BEFORE INSERT ON `text_entries_textentryreused`
WHEN NEW.`user_id` <> (SELECT `user_id` FROM `text_entries_textentry` WHERE `id` = NEW.`text_entry_id`)
BEGIN
  SELECT RAISE(ABORT, 'cross_user_link: a reuse of another user''s entry');
END;
--> statement-breakpoint
CREATE TRIGGER `text_entries_textentryreused_own_rows_update`
BEFORE UPDATE OF `user_id`, `text_entry_id` ON `text_entries_textentryreused`
WHEN NEW.`user_id` <> (SELECT `user_id` FROM `text_entries_textentry` WHERE `id` = NEW.`text_entry_id`)
BEGIN
  SELECT RAISE(ABORT, 'cross_user_link: a reuse of another user''s entry');
END;
