CREATE TABLE `text_entries_textentryreused` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date_created` text NOT NULL,
	`text_entry_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`text_entry_id`) REFERENCES `text_entries_textentry`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `text_entries_textentryreused_text_entry_id_idx` ON `text_entries_textentryreused` (`text_entry_id`);--> statement-breakpoint
CREATE INDEX `text_entries_textentryreused_user_id_idx` ON `text_entries_textentryreused` (`user_id`);--> statement-breakpoint
CREATE TABLE `tags_tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`date_created` text NOT NULL,
	`date_updated` text NOT NULL,
	`user_id` integer NOT NULL,
	`entry_count` integer DEFAULT 0 NOT NULL,
	`date_last_used` text,
	`order` integer NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users_user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tags_tag_name_length" CHECK(length("tags_tag"."name") <= 24),
	CONSTRAINT "tags_tag_order_check" CHECK("tags_tag"."order" >= 0)
);
--> statement-breakpoint
CREATE INDEX `tags_tag_user_order_idx` ON `tags_tag` (`user_id`,`order`);--> statement-breakpoint
CREATE INDEX `tags_tag_user_updated_idx` ON `tags_tag` (`user_id`,`date_updated`);--> statement-breakpoint
CREATE UNIQUE INDEX `One tag of same name per user` ON `tags_tag` (`name`,`user_id`);--> statement-breakpoint
CREATE TABLE `tags_tagtextentrythroughmodel` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`text_entry_id` integer NOT NULL,
	`date_created` text NOT NULL,
	`date_updated` text NOT NULL,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`tag_id`) REFERENCES `tags_tag`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`text_entry_id`) REFERENCES `text_entries_textentry`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users_user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "tags_tagtextentrythroughmodel_order_check" CHECK("tags_tagtextentrythroughmodel"."order" >= 0)
);
--> statement-breakpoint
CREATE INDEX `tags_tagtextentrythroughmodel_tag_order_idx` ON `tags_tagtextentrythroughmodel` (`tag_id`,`order`);--> statement-breakpoint
CREATE INDEX `tags_tagtextentrythroughmodel_text_entry_id_idx` ON `tags_tagtextentrythroughmodel` (`text_entry_id`);--> statement-breakpoint
CREATE INDEX `tags_tagtextentrythroughmodel_user_id_idx` ON `tags_tagtextentrythroughmodel` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_tagtextentrythroughmodel_tag_id_text_entry_id_uniq` ON `tags_tagtextentrythroughmodel` (`tag_id`,`text_entry_id`);--> statement-breakpoint
CREATE TABLE `text_entries_textentry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`body` text NOT NULL,
	`subject` text NOT NULL,
	`date_created` text NOT NULL,
	`date_updated` text NOT NULL,
	`user_id` integer NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`tag_count` integer DEFAULT 0 NOT NULL,
	`reused_count` integer DEFAULT 0 NOT NULL,
	`reused_date` text,
	FOREIGN KEY (`user_id`) REFERENCES `users_user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "text_entries_textentry_body_length" CHECK(length("text_entries_textentry"."body") <= 1024),
	CONSTRAINT "text_entries_textentry_subject_length" CHECK(length("text_entries_textentry"."subject") <= 255)
);
--> statement-breakpoint
CREATE INDEX `text_entries_textentry_user_id_idx` ON `text_entries_textentry` (`user_id`,`date_updated`);--> statement-breakpoint
CREATE TABLE `authtoken_token` (
	`key` text PRIMARY KEY NOT NULL,
	`created` text NOT NULL,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users_user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "authtoken_token_key_length" CHECK(length("authtoken_token"."key") = 40)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authtoken_token_user_id_unique` ON `authtoken_token` (`user_id`);--> statement-breakpoint
CREATE TABLE `users_user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`is_superuser` integer DEFAULT false NOT NULL,
	`is_staff` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login` text,
	`date_joined` text NOT NULL,
	`date_updated` text NOT NULL,
	`login_count` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "users_user_username_length" CHECK(length("users_user"."username") <= 150),
	CONSTRAINT "users_user_email_length" CHECK(length("users_user"."email") <= 254),
	CONSTRAINT "users_user_login_count_check" CHECK("users_user"."login_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_user_username_unique` ON `users_user` (`username`);--> statement-breakpoint
CREATE INDEX `users_user_email_idx` ON `users_user` (`email`);