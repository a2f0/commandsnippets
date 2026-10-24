-- Clients record a reuse each time an entry is copied, queued like their other
-- writes. A queued reuse carries the client's id for it (client_id, unique per
-- user and data version), so one retried after a lost answer is counted once.
-- A nullable column added in place: the Worker still running selects its
-- columns by name.
ALTER TABLE `text_entries_textentryreused` ADD `client_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `text_entries_textentryreused_client_id_unique` ON `text_entries_textentryreused` (`user_id`,`version`,`client_id`) WHERE "text_entries_textentryreused"."client_id" IS NOT NULL;