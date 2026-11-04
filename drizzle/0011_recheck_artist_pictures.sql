-- Deezer pictures used to be matched by artist name alone, which picked the
-- wrong one of several artists sharing a name. The worker looks these up again.
UPDATE "artists" SET "image_url" = NULL, "picture_looked_up_at" = NULL WHERE "image_url" LIKE '%dzcdn.net%';
