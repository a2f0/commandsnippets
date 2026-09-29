-- A tag's revision (date_updated) advances whenever anything clients sync
-- through the tag changes. Clients read a tag's entries once
-- (`GET /entries?filter[tags.id]=<tag>`), then the entries changed since
-- (`filter[date_updated.gt]=<cursor>`, which lists an entry that left the tag
-- too), and skip that request while the tag's revision (from
-- `GET /tags?filter[date_updated.gt]=...`) is the one they last synced it at.
-- So a tag advances when:
-- - one of its entries advances (an edit, a soft delete, and the entry touches
--   that tagging, untagging, taking over and re-ranking junctions do):
--   `text_entries_after_revision`;
-- - an entry leaves it (the entry's touch no longer reaches it), or its
--   counters change: the junction triggers, re-created below.
--
-- The value is the tag owner's next tag revision, lib/revision.ts's formula in
-- SQL (keep the two in sync): the later of D1's clock and one millisecond past
-- the owner's latest tag revision, as fixed-width text. The owner is read by
-- id, so the subquery does not depend on the row being updated and SQLite
-- evaluates it once per statement: every tag one entry change advances gets
-- the same revision.

DROP TRIGGER `tags_entries_after_insert`;
--> statement-breakpoint
-- TagTextEntryThroughModel created: bump entry/tag counters, mark tag used,
-- advance the tag's revision.
CREATE TRIGGER `tags_entries_after_insert`
AFTER INSERT ON `tags_tagtextentrythroughmodel`
BEGIN
  UPDATE `text_entries_textentry`
    SET `tag_count` = `tag_count` + 1
    WHERE `id` = NEW.`text_entry_id`;
  UPDATE `tags_tag`
    SET `entry_count` = `entry_count` + 1,
        `date_last_used` = NEW.`date_created`,
        `date_updated` = (
          SELECT strftime('%Y-%m-%dT%H:%M:%S', v / 1000000, 'unixepoch')
            || '.' || printf('%06d', v % 1000000)
          FROM (
            SELECT MAX(
              CAST(unixepoch('subsec') * 1000000 AS INTEGER),
              COALESCE(MAX(
                unixepoch(substr(t.`date_updated`, 1, 19)) * 1000000
                  + CAST(substr(t.`date_updated`, 21, 6) AS INTEGER)
              ), 0) + 1000
            ) AS v
            FROM `tags_tag` AS t
            WHERE t.`user_id` = (
              SELECT `user_id` FROM `tags_tag` WHERE `id` = NEW.`tag_id`
            )
          )
        )
    WHERE `id` = NEW.`tag_id`;
END;
--> statement-breakpoint
DROP TRIGGER `tags_entries_after_delete`;
--> statement-breakpoint
-- TagTextEntryThroughModel deleted: decrement counters, recompute the tag's
-- date_last_used from its most recent remaining junction, and advance the
-- tag's revision (the entry left it).
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
        ),
        `date_updated` = (
          SELECT strftime('%Y-%m-%dT%H:%M:%S', v / 1000000, 'unixepoch')
            || '.' || printf('%06d', v % 1000000)
          FROM (
            SELECT MAX(
              CAST(unixepoch('subsec') * 1000000 AS INTEGER),
              COALESCE(MAX(
                unixepoch(substr(t.`date_updated`, 1, 19)) * 1000000
                  + CAST(substr(t.`date_updated`, 21, 6) AS INTEGER)
              ), 0) + 1000
            ) AS v
            FROM `tags_tag` AS t
            WHERE t.`user_id` = (
              SELECT `user_id` FROM `tags_tag` WHERE `id` = OLD.`tag_id`
            )
          )
        )
    WHERE `id` = OLD.`tag_id`;
END;
--> statement-breakpoint
-- TextEntry revision advanced: advance the owner's tags the entry is in, the
-- way the entries sync of those tags sees them (the owner's own junctions and
-- tags). The counter and reuse triggers never set date_updated, so they do not
-- fire it.
CREATE TRIGGER `text_entries_after_revision`
AFTER UPDATE OF `date_updated` ON `text_entries_textentry`
WHEN NEW.`date_updated` IS NOT OLD.`date_updated`
BEGIN
  UPDATE `tags_tag`
    SET `date_updated` = (
      SELECT strftime('%Y-%m-%dT%H:%M:%S', v / 1000000, 'unixepoch')
        || '.' || printf('%06d', v % 1000000)
      FROM (
        SELECT MAX(
          CAST(unixepoch('subsec') * 1000000 AS INTEGER),
          COALESCE(MAX(
            unixepoch(substr(t.`date_updated`, 1, 19)) * 1000000
              + CAST(substr(t.`date_updated`, 21, 6) AS INTEGER)
          ), 0) + 1000
        ) AS v
        FROM `tags_tag` AS t
        WHERE t.`user_id` = NEW.`user_id`
      )
    )
    WHERE `user_id` = NEW.`user_id`
      AND `id` IN (
        SELECT `tag_id` FROM `tags_tagtextentrythroughmodel`
        WHERE `text_entry_id` = NEW.`id` AND `user_id` = NEW.`user_id`
      );
END;
