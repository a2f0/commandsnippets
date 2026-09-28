-- The second half of removing is_superuser (see 0004_admin.sql). Safe once
-- every deployed Worker is at or past 0004's release, which no longer reads
-- the column. DROP COLUMN edits the table in place; rebuilding users_user
-- would cascade-delete every user's data.
ALTER TABLE `users_user` DROP COLUMN `is_superuser`;
