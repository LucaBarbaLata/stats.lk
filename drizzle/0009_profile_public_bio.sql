ALTER TYPE "public"."profile_visibility" ADD VALUE 'public';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "custom_display_name" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;