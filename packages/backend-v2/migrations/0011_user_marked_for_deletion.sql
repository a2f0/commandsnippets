-- Staff can mark an account for deletion through the admin API. A nullable
-- column added in place: the Worker still running selects its columns by
-- name. No account starts marked.
ALTER TABLE `users_user` ADD `date_marked_for_deletion` text;
