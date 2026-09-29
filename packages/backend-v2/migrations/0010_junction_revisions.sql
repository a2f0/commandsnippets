-- Untagging soft-deletes a junction (`is_deleted`), so a tag's junctions,
-- listed in revision order (`GET /tags_entries?filter[tag.id]=...` after a
-- cursor), show every change in the tag: entries joining it (a junction
-- created or restored), leaving it (deleted), re-ranked, and edited. For the
-- last, an entry's revision now advances its junctions too (in the tags it
-- is in), as it already advanced those tags (0008_tag_revisions.sql).
--
-- A deleted junction is out of the tag: the counters, `date_last_used`, and
-- the tags an entry's revision advances count only the others, and deleting
-- and restoring one moves the counters and advances the tag as removing and
-- creating it did. Revisions are lib/revision.ts's formula in SQL, as in
-- 0008 (keep them in sync): the owner's next tag revision for tags, and the
-- entry owner's next junction revision for junctions; each subquery depends
-- only on the owner, so every row one statement advances gets one revision.

DROP TRIGGER `tags_entries_after_insert`;
--> statement-breakpoint
-- TagTextEntryThroughModel created: bump entry/tag counters, mark tag used,
-- advance the tag's revision.
CREATE TRIGGER `tags_entries_after_insert`
AFTER INSERT ON `tags_tagtextentrythroughmodel`
WHEN NEW.`is_deleted` = 0
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
-- TagTextEntryThroughModel removed (only a cascade does: untagging
-- soft-deletes), unless already deleted: as a soft delete.
CREATE TRIGGER `tags_entries_after_delete`
AFTER DELETE ON `tags_tagtextentrythroughmodel`
WHEN OLD.`is_deleted` = 0
BEGIN
  UPDATE `text_entries_textentry`
    SET `tag_count` = `tag_count` - 1
    WHERE `id` = OLD.`text_entry_id`;
  UPDATE `tags_tag`
    SET `entry_count` = `entry_count` - 1,
        `date_last_used` = (
          SELECT MAX(`date_created`) FROM `tags_tagtextentrythroughmodel`
          WHERE `tag_id` = OLD.`tag_id` AND `is_deleted` = 0
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
-- TagTextEntryThroughModel deleted (untagged): decrement counters, recompute
-- the tag's date_last_used from its most recent remaining junction, and
-- advance the tag's revision (the entry left it).
CREATE TRIGGER `tags_entries_after_soft_delete`
AFTER UPDATE OF `is_deleted` ON `tags_tagtextentrythroughmodel`
WHEN OLD.`is_deleted` = 0 AND NEW.`is_deleted` = 1
BEGIN
  UPDATE `text_entries_textentry`
    SET `tag_count` = `tag_count` - 1
    WHERE `id` = NEW.`text_entry_id`;
  UPDATE `tags_tag`
    SET `entry_count` = `entry_count` - 1,
        `date_last_used` = (
          SELECT MAX(`date_created`) FROM `tags_tagtextentrythroughmodel`
          WHERE `tag_id` = NEW.`tag_id` AND `is_deleted` = 0
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
              SELECT `user_id` FROM `tags_tag` WHERE `id` = NEW.`tag_id`
            )
          )
        )
    WHERE `id` = NEW.`tag_id`;
END;
--> statement-breakpoint
-- TagTextEntryThroughModel restored (tagged again): as created.
CREATE TRIGGER `tags_entries_after_restore`
AFTER UPDATE OF `is_deleted` ON `tags_tagtextentrythroughmodel`
WHEN OLD.`is_deleted` = 1 AND NEW.`is_deleted` = 0
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
DROP TRIGGER `text_entries_after_revision`;
--> statement-breakpoint
-- TextEntry revision advanced: advance the owner's tags the entry is in, and
-- the owner's junctions that put it there, the way the syncs of those tags
-- see them (the owner's own junctions and tags, not deleted). The counter and
-- reuse triggers never set date_updated, so they do not fire it.
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
        WHERE `text_entry_id` = NEW.`id`
          AND `user_id` = NEW.`user_id`
          AND `is_deleted` = 0
      );
  UPDATE `tags_tagtextentrythroughmodel`
    SET `date_updated` = (
      SELECT strftime('%Y-%m-%dT%H:%M:%S', v / 1000000, 'unixepoch')
        || '.' || printf('%06d', v % 1000000)
      FROM (
        SELECT MAX(
          CAST(unixepoch('subsec') * 1000000 AS INTEGER),
          COALESCE(MAX(
            unixepoch(substr(j.`date_updated`, 1, 19)) * 1000000
              + CAST(substr(j.`date_updated`, 21, 6) AS INTEGER)
          ), 0) + 1000
        ) AS v
        FROM `tags_tagtextentrythroughmodel` AS j
        WHERE j.`user_id` = NEW.`user_id`
      )
    )
    WHERE `text_entry_id` = NEW.`id`
      AND `user_id` = NEW.`user_id`
      AND `is_deleted` = 0;
END;
