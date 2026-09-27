DROP INDEX `users_user_email_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_user_email_unique` ON `users_user` (`email`) WHERE "users_user"."email" != '';