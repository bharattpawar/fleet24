CREATE TABLE IF NOT EXISTS "rider_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rider_id" uuid NOT NULL,
	"latitude" numeric(10, 7) NOT NULL,
	"longitude" numeric(10, 7) NOT NULL,
	"accuracy" numeric(6, 2),
	"heading" numeric(5, 2),
	"speed" numeric(5, 2),
	"captured_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "rider_latest_locations" CASCADE;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rider_locations" ADD CONSTRAINT "rider_locations_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rider_locations_rider_id_idx" ON "rider_locations" USING btree ("rider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rider_locations_updated_at_idx" ON "rider_locations" USING btree ("updated_at");