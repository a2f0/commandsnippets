-- Clients queue their writes (offline too) and send them later, naming when
-- each was made (api-shared's CLIENT_UPDATED_HEADER). A write applies only
-- when it is no older than the row's last client write: last writer wins by
-- edit time, not by arrival. Nullable columns added in place (the Worker
-- still running selects its columns by name), and existing rows start at
-- their revision. The revision triggers fire on date_updated and is_deleted
-- only, so the backfill advances no revision. A tag or entry a queued
-- create made keeps the client's id for it (client_id, unique per user), so
-- a retried create finds it whatever it is called by then; a tag create
-- answered with a tag of the name the user had keeps its client id in
-- tags_tagclientid, to the same end.
ALTER TABLE `tags_tag` ADD `client_updated` text;--> statement-breakpoint
ALTER TABLE `tags_tagtextentrythroughmodel` ADD `client_updated` text;--> statement-breakpoint
ALTER TABLE `text_entries_textentry` ADD `client_updated` text;--> statement-breakpoint
UPDATE `tags_tag` SET `client_updated` = `date_updated`;--> statement-breakpoint
UPDATE `tags_tagtextentrythroughmodel` SET `client_updated` = `date_updated`;--> statement-breakpoint
UPDATE `text_entries_textentry` SET `client_updated` = `date_updated`;--> statement-breakpoint
-- A queued create carries a client id: a create retried after a lost answer
-- finds the row it made (a tag whatever it is named by then) instead of
-- making another.
ALTER TABLE `tags_tag` ADD `client_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `tags_tag_client_id_unique` ON `tags_tag` (`user_id`,`client_id`) WHERE "tags_tag"."client_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `text_entries_textentry` ADD `client_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `text_entries_textentry_client_id_unique` ON `text_entries_textentry` (`user_id`,`client_id`) WHERE "text_entries_textentry"."client_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `tags_tagclientid` (
	`user_id` integer NOT NULL,
	`client_id` text NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `client_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users_user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags_tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tags_tagclientid_tag_id_idx` ON `tags_tagclientid` (`tag_id`);
