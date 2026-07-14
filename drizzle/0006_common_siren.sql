CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "location" geography(Point, 4326) GENERATED ALWAYS AS (ST_MakePoint("lng", "lat")::geography) STORED;--> statement-breakpoint
CREATE INDEX "places_location_idx" ON "places" USING gist ("location");
