-- The second half of removing date_restored (the restore cutoff's, which data
-- versions replace: 0017). Safe once every deployed Worker is at or past the
-- data versions release (0.2.10), which no longer reads the column. DROP
-- COLUMN edits the table in place; rebuilding users_user would cascade-delete
-- every user's data.
ALTER TABLE `users_user` DROP COLUMN `date_restored`;
