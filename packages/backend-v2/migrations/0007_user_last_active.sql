-- Every authenticated request records when the user was last active. A
-- nullable column added in place: the Worker still running selects its
-- columns by name. Existing accounts start at their last login, the latest
-- activity on record (NULL if they never logged in).
ALTER TABLE `users_user` ADD `last_active` text;
--> statement-breakpoint
UPDATE `users_user` SET `last_active` = `last_login`;
