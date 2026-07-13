-- Re-link (S5): S4's backfill (0003) ran once, so any check-in written by old
-- code during the S4 deploy window landed with place_uuid = NULL. S5 code reads
-- place data via the place_uuid join and stops touching the denormalized columns
-- below, so those orphans would render place-less. Re-run the 0003 backfill
-- block here — using the denormalized columns while they still exist — so every
-- row is linked before S5 serves and before S5b drops the columns. Idempotent
-- (ON CONFLICT DO NOTHING + WHERE place_uuid IS NULL); a no-op when there are no
-- orphans, which is the normal case.
INSERT INTO "places" ("id", "google_place_id", "name", "lat", "lng", "created_at", "updated_at")
SELECT DISTINCT ON ("place_id")
  gen_random_uuid()::text, "place_id", "place_name", "lat", "lng", now(), now()
FROM "check_ins"
WHERE "place_uuid" IS NULL AND "place_id" IS NOT NULL
ORDER BY "place_id", "visit_datetime" DESC, "id" DESC
ON CONFLICT ("google_place_id") DO NOTHING;--> statement-breakpoint
UPDATE "check_ins" AS "c"
SET "place_uuid" = "p"."id"
FROM "places" AS "p"
WHERE "p"."google_place_id" = "c"."place_id" AND "c"."place_uuid" IS NULL;--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "place_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "place_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "lat" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "lng" DROP NOT NULL;