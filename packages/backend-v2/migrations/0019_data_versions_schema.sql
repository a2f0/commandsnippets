CREATE TABLE `users_dataversion` (
	`user_id` integer NOT NULL,
	`version` integer NOT NULL,
	`date_created` text NOT NULL,
	`origin` text NOT NULL,
	`backup_username` text,
	`backup_exported` text,
	PRIMARY KEY(`user_id`, `version`),
	FOREIGN KEY (`user_id`) REFERENCES `users_user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "users_dataversion_version_check" CHECK("users_dataversion"."version" >= 1),
	CONSTRAINT "users_dataversion_origin_check" CHECK("users_dataversion"."origin" IN ('initial', 'restore'))
);
--> statement-breakpoint
DROP INDEX `text_entries_textentryreused_user_id_idx`;--> statement-breakpoint
ALTER TABLE `text_entries_textentryreused` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `text_entries_textentryreused_user_id_idx` ON `text_entries_textentryreused` (`user_id`,`version`);--> statement-breakpoint
DROP INDEX `tags_tag_user_order_idx`;--> statement-breakpoint
DROP INDEX `tags_tag_user_updated_idx`;--> statement-breakpoint
DROP INDEX `One tag of same name per user`;--> statement-breakpoint
ALTER TABLE `tags_tag` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `tags_tag_user_order_idx` ON `tags_tag` (`user_id`,`version`,`order`);--> statement-breakpoint
CREATE INDEX `tags_tag_user_updated_idx` ON `tags_tag` (`user_id`,`version`,`date_updated`);--> statement-breakpoint
CREATE UNIQUE INDEX `One tag of same name per user` ON `tags_tag` (`name`,`user_id`,`version`);--> statement-breakpoint
DROP INDEX `tags_tagtextentrythroughmodel_user_updated_idx`;--> statement-breakpoint
ALTER TABLE `tags_tagtextentrythroughmodel` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `tags_tagtextentrythroughmodel_user_updated_idx` ON `tags_tagtextentrythroughmodel` (`user_id`,`version`,`date_updated`);--> statement-breakpoint
DROP INDEX `text_entries_textentry_user_id_idx`;--> statement-breakpoint
DROP INDEX `text_entries_textentry_client_id_unique`;--> statement-breakpoint
ALTER TABLE `text_entries_textentry` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `text_entries_textentry_user_id_idx` ON `text_entries_textentry` (`user_id`,`version`,`date_updated`);--> statement-breakpoint
CREATE UNIQUE INDEX `text_entries_textentry_client_id_unique` ON `text_entries_textentry` (`user_id`,`version`,`client_id`) WHERE "text_entries_textentry"."client_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `users_user` ADD `active_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users_user` ADD `last_version` integer DEFAULT 1 NOT NULL;