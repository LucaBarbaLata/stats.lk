CREATE TABLE "spotify_pauses" (
	"call" text PRIMARY KEY NOT NULL,
	"until" timestamp with time zone NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
-- Catalog lookups had the only pause so far; keep it if it's still running
INSERT INTO "spotify_pauses" ("call", "until", "reason")
SELECT 'catalog', "catalog_paused_until", 'no reason given' FROM "worker_heartbeat" WHERE "catalog_paused_until" > now();--> statement-breakpoint
ALTER TABLE "worker_heartbeat" DROP COLUMN "catalog_paused_until";