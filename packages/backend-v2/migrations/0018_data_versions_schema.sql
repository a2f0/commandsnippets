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
-- Rebuilt for its new primary key (a client id names one tag in a version).
-- Edited from drizzle-kit's: the copy takes each alias's version from its
-- tag (the old table has none), and no PRAGMA foreign_keys is needed, since
-- no table refers to this one.
CREATE TABLE `__new_tags_tagclientid` (
	`user_id` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`client_id` text NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `version`, `client_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users_user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags_tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tags_tagclientid`(`user_id`, `version`, `client_id`, `tag_id`) SELECT `a`.`user_id`, `t`.`version`, `a`.`client_id`, `a`.`tag_id` FROM `tags_tagclientid` AS `a` JOIN `tags_tag` AS `t` ON `t`.`id` = `a`.`tag_id`;--> statement-breakpoint
DROP TABLE `tags_tagclientid`;--> statement-breakpoint
ALTER TABLE `__new_tags_tagclientid` RENAME TO `tags_tagclientid`;--> statement-breakpoint
CREATE INDEX `tags_tagclientid_tag_id_idx` ON `tags_tagclientid` (`tag_id`);--> statement-breakpoint
ALTER TABLE `users_user` ADD `active_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users_user` ADD `last_version` integer DEFAULT 1 NOT NULL;