ALTER TABLE `text_entries_textentry` ADD `subject_folded` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `text_entries_textentry` ADD `body_folded` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Backfill for rows that predate the columns. SQLite's lower() folds ASCII
-- only; a fresh import computes full Unicode folds (scripts/import-postgres.ts),
-- and every write through the API does too (src/lib/search.ts).
UPDATE `text_entries_textentry` SET `subject_folded` = lower(`subject`), `body_folded` = lower(`body`);
