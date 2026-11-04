ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
-- Existing users get a username from their display name: lowercase letters,
-- digits, "_" and "." only, at most 24 characters, a numbered suffix when two
-- would collide, and "user" plus part of the id when nothing usable is left.
UPDATE "users" u SET "username" = numbered.username
FROM (
  SELECT id,
    base || CASE WHEN row_number() OVER (PARTITION BY base ORDER BY created_at) > 1
      THEN (row_number() OVER (PARTITION BY base ORDER BY created_at))::text ELSE '' END AS username
  FROM (
    SELECT id, created_at,
      CASE WHEN length(slug) >= 3 THEN slug ELSE 'user' || left(replace(id::text, '-', ''), 8) END AS base
    FROM (
      SELECT id, created_at, left(lower(regexp_replace(display_name, '[^a-zA-Z0-9_.]+', '', 'g')), 24) AS slug
      FROM "users"
    ) slugs
  ) bases
) numbered
WHERE u.id = numbered.id;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");
