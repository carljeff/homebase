CREATE TABLE `crm_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`label` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`digest` text DEFAULT '' NOT NULL,
	`snapshot_json` text,
	`last_success_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_one_active_owner` ON `crm_devices` (`owner_id`) WHERE "crm_devices"."enabled"=1;