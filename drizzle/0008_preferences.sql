ALTER TABLE "sessions" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "week_start" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_range" text DEFAULT '4w' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_sort" text DEFAULT 'plays' NOT NULL;