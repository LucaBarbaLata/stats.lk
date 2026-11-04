ALTER TABLE "users" ADD COLUMN "top_lists_fetched_at" timestamp with time zone;--> statement-breakpoint
-- A picture from Deezer used to count as having looked the artist up, so
-- Spotify was never asked for its own photo. Ask for these.
UPDATE "artists" SET "details_fetched_at" = NULL WHERE NOT "imported" AND "image_url" LIKE '%dzcdn.net%';
