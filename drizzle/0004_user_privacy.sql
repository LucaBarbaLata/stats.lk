ALTER TABLE "users" ADD COLUMN "visibility" "profile_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "show_now_playing" boolean DEFAULT true NOT NULL;