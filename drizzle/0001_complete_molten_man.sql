CREATE TABLE `imported_recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`import_key` text NOT NULL,
	`source_hash` text NOT NULL,
	`source_data` text NOT NULL,
	`overrides` text DEFAULT '{}' NOT NULL,
	`image_hash` text,
	`version` integer DEFAULT 1 NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `imported_recipes_import_key_unique` ON `imported_recipes` (`import_key`);