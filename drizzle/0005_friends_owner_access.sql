CREATE TABLE `friends_access` (
	`slot` integer PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`email_digest` text NOT NULL,
	`created_at` text NOT NULL
);
