CREATE TABLE IF NOT EXISTS "service_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"center_latitude" numeric(10, 7) NOT NULL,
	"center_longitude" numeric(10, 7) NOT NULL,
	"radius_meters" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_zones_radius_check" CHECK ("radius_meters" BETWEEN 100 AND 50000)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_zones" ADD CONSTRAINT "service_zones_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_zones_is_active_idx" ON "service_zones" USING btree ("is_active");
