ALTER TABLE `tags_tag` ADD `is_public` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `text_entries_textentry` ADD `is_public` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users_user` ADD `public_revision` integer DEFAULT 0 NOT NULL;