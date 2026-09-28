CREATE TABLE `admin_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created` text NOT NULL,
	`action` text NOT NULL,
	`actor_id` integer,
	`actor_username` text NOT NULL,
	`target_user_id` integer,
	`target_username` text NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `users_user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`target_user_id`) REFERENCES `users_user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `admin_audit_log_created_idx` ON `admin_audit_log` (`created`);--> statement-breakpoint
CREATE INDEX `admin_audit_log_target_user_id_idx` ON `admin_audit_log` (`target_user_id`);--> statement-breakpoint
ALTER TABLE `users_user` DROP COLUMN `is_superuser`;