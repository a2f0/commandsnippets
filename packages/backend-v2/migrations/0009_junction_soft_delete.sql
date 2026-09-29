DROP INDEX `tags_tagtextentrythroughmodel_user_id_idx`;--> statement-breakpoint
ALTER TABLE `tags_tagtextentrythroughmodel` ADD `is_deleted` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `tags_tagtextentrythroughmodel_user_updated_idx` ON `tags_tagtextentrythroughmodel` (`user_id`,`date_updated`);--> statement-breakpoint
CREATE INDEX `tags_tagtextentrythroughmodel_tag_updated_idx` ON `tags_tagtextentrythroughmodel` (`tag_id`,`date_updated`);