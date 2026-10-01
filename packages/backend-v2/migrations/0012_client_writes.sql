-- Clients queue their writes (offline too) and send them later, naming when
-- each was made (api-shared's CLIENT_UPDATED_HEADER). A write applies only
-- when it is no older than the row's last client write: last writer wins by
-- edit time, not by arrival. Nullable columns added in place (the Worker
-- still running selects its columns by name), and existing rows start at
-- their revision. The revision triggers fire on date_updated and is_deleted
-- only, so the backfill advances no revision. A queued create carries the
-- client's id for its row: an entry keeps it (client_id, unique per user),
-- and every tag create's is kept in tags_tagclientid with the tag it was
-- answered with, so a retried create finds that row whatever it is called
-- by then. A tag renders the client id of the create that made it. A write
-- made ahead of the API's clock counts as now; sync_clientwrite keeps the
-- time each write the client named (Client-Write-Id) was counted at (as
-- long as the user), so its retries count it too.
ALTER TABLE `tags_tag` ADD `client_updated` text;--> statement-breakpoint
ALTER TABLE `tags_tagtextentrythroughmodel` ADD `client_updated` text;--> statement-breakpoint
ALTER TABLE `text_entries_textentry` ADD `client_updated` text;--> statement-breakpoint
UPDATE `tags_tag` SET `client_updated` = `date_updated`;--> statement-breakpoint
UPDATE `tags_tagtextentrythroughmodel` SET `client_updated` = `date_updated`;--> statement-breakpoint
UPDATE `text_entries_textentry` SET `client_updated` = `date_updated`;--> statement-breakpoint
ALTER TABLE `tags_tag` ADD `client_id` text;--> statement-breakpoint
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
CREATE INDEX `tags_tagclientid_tag_id_idx` ON `tags_tagclientid` (`tag_id`);--> statement-breakpoint
CREATE TABLE `sync_clientwrite` (
	`user_id` integer NOT NULL,
	`write_id` text NOT NULL,
	`made` text NOT NULL,
	`date_created` text NOT NULL,
	PRIMARY KEY(`user_id`, `write_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users_user`(`id`) ON UPDATE no action ON DELETE cascade
);
