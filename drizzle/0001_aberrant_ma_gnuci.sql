CREATE TABLE `daily_activity` (
	`user_id` text NOT NULL,
	`activity_date` text NOT NULL,
	`menu_batch_count` integer DEFAULT 0 NOT NULL,
	`menu_item_count` integer DEFAULT 0 NOT NULL,
	`image_count` integer DEFAULT 0 NOT NULL,
	`last_activity_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `activity_date`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_activity_date_idx` ON `daily_activity` (`activity_date`);