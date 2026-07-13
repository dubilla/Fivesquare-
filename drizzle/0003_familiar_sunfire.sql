CREATE TABLE "places" (
	"id" text PRIMARY KEY NOT NULL,
	"google_place_id" text NOT NULL,
	"name" text NOT NULL,
	"formatted_address" text,
	"primary_type" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_google_place_id_unique" UNIQUE("google_place_id")
);
--> statement-breakpoint
ALTER TABLE "check_ins" ADD COLUMN "place_uuid" text;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_place_uuid_places_id_fk" FOREIGN KEY ("place_uuid") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill (S4): create one normalized place per distinct google place_id from
-- existing check-ins, taking the most-recent (by visit_datetime) name/coords —
-- names drift over time, so the newest wins. Then link each check-in to its
-- place. Address/type stay NULL: legacy check-ins never captured them.
-- Idempotent by construction — safe to re-run:
--   * ON CONFLICT (google_place_id) DO NOTHING never double-inserts a place;
--   * the UPDATE only touches check_ins whose place_uuid is still NULL.
-- Mirrors the dedupe rule unit-tested in src/lib/places/backfill.ts.
INSERT INTO "places" ("id", "google_place_id", "name", "lat", "lng", "created_at", "updated_at")
SELECT DISTINCT ON ("place_id")
  gen_random_uuid()::text, "place_id", "place_name", "lat", "lng", now(), now()
FROM "check_ins"
ORDER BY "place_id", "visit_datetime" DESC, "id" DESC
ON CONFLICT ("google_place_id") DO NOTHING;--> statement-breakpoint
UPDATE "check_ins" AS "c"
SET "place_uuid" = "p"."id"
FROM "places" AS "p"
WHERE "p"."google_place_id" = "c"."place_id" AND "c"."place_uuid" IS NULL;