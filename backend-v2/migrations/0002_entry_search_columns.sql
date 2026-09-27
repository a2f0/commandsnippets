ALTER TABLE `text_entries_textentry` ADD `subject_folded` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `text_entries_textentry` ADD `body_folded` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- Backfill for rows that predate the columns. SQLite's upper() folds ASCII
-- only; a fresh import computes full Unicode folds (scripts/import-postgres.ts),
-- and every write through the API does too (src/lib/search.ts).
UPDATE `text_entries_textentry` SET `subject_folded` = upper(`subject`), `body_folded` = upper(`body`);
