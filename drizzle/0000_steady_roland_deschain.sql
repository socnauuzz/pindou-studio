CREATE TABLE `access_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`code_prefix` text NOT NULL,
	`plan` text NOT NULL,
	`usage_limit` integer NOT NULL,
	`used_count` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_keys_code_hash_unique` ON `access_keys` (`code_hash`);--> statement-breakpoint
CREATE TABLE `key_events` (
	`id` text PRIMARY KEY NOT NULL,
	`key_id` text NOT NULL,
	`event_type` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `key_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`key_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `key_sessions_token_hash_unique` ON `key_sessions` (`token_hash`);