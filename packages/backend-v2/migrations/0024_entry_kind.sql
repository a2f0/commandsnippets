-- What an entry is: a snippet (text to copy) or a shortcut (keys to press),
-- api-shared's ENTRY_KINDS. Every existing entry is a snippet. Added in
-- place, with a column CHECK rather than a table one (which drizzle-kit would
-- add by rebuilding the table): the Worker still running selects its columns
-- by name, and its inserts take the default.
ALTER TABLE `text_entries_textentry` ADD `kind` text DEFAULT 'snippet' NOT NULL CONSTRAINT `text_entries_textentry_kind` CHECK (`kind` IN ('snippet', 'shortcut'));
