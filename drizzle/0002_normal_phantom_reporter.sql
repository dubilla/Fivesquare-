CREATE TYPE "public"."verdict" AS ENUM('yes', 'maybe', 'no');--> statement-breakpoint
-- Existing values are UTC wall-clock times (drizzle serialized Date.toISOString()).
-- The explicit `USING ... AT TIME ZONE 'UTC'` makes the conversion deterministic
-- regardless of the migrating session's TimeZone setting (hand-added to the
-- drizzle-generated statements; snapshot is unchanged).
ALTER TABLE "check_ins" ALTER COLUMN "visit_datetime" SET DATA TYPE timestamp with time zone USING "visit_datetime" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "check_ins" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "check_ins" ADD COLUMN "verdict" "verdict";