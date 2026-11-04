ALTER TABLE "albums" ADD COLUMN "imported" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "albums" ADD COLUMN "picture_looked_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "imported" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "picture_looked_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "worker_heartbeat" ADD COLUMN "catalog_paused_until" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "albums_lower_name" ON "albums" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "artists_lower_name" ON "artists" USING btree (lower("name"));