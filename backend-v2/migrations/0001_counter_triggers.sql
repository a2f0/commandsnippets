-- Replaces the Django post_save/post_delete signal handlers that maintained
-- denormalized counters (tags/models.py, text_entries/models.py). Triggers are
-- atomic with the write and also fire for ON DELETE CASCADE.

-- TagTextEntryThroughModel created: bump entry/tag counters, mark tag used.
CREATE TRIGGER `tags_entries_after_insert`
AFTER INSERT ON `tags_tagtextentrythroughmodel`
BEGIN
  UPDATE `text_entries_textentry`
    SET `tag_count` = `tag_count` + 1
    WHERE `id` = NEW.`text_entry_id`;
  UPDATE `tags_tag`
    SET `entry_count` = `entry_count` + 1,
        `date_last_used` = NEW.`date_created`
    WHERE `id` = NEW.`tag_id`;
END;
--> statement-breakpoint
-- TagTextEntryThroughModel deleted: decrement counters and recompute the
-- tag's date_last_used from its most recent remaining junction.
CREATE TRIGGER `tags_entries_after_delete`
AFTER DELETE ON `tags_tagtextentrythroughmodel`
BEGIN
  UPDATE `text_entries_textentry`
    SET `tag_count` = `tag_count` - 1
    WHERE `id` = OLD.`text_entry_id`;
  UPDATE `tags_tag`
    SET `entry_count` = `entry_count` - 1,
        `date_last_used` = (
          SELECT MAX(`date_created`) FROM `tags_tagtextentrythroughmodel`
          WHERE `tag_id` = OLD.`tag_id`
        )
    WHERE `id` = OLD.`tag_id`;
END;
--> statement-breakpoint
-- TextEntryReused created/deleted: maintain reused_count and reused_date.
CREATE TRIGGER `entry_reuses_after_insert`
AFTER INSERT ON `text_entries_textentryreused`
BEGIN
  UPDATE `text_entries_textentry`
    SET `reused_count` = `reused_count` + 1,
        `reused_date` = NEW.`date_created`
    WHERE `id` = NEW.`text_entry_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `entry_reuses_after_delete`
AFTER DELETE ON `text_entries_textentryreused`
BEGIN
  UPDATE `text_entries_textentry`
    SET `reused_count` = `reused_count` - 1,
        `reused_date` = strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000'
    WHERE `id` = OLD.`text_entry_id`;
END;
