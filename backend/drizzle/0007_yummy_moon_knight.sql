CREATE TYPE "public"."rider_availability_status" AS ENUM('offline', 'available', 'busy');--> statement-breakpoint
CREATE TYPE "public"."rider_vehicle_type" AS ENUM('bicycle', 'motorcycle', 'scooter', 'ev', 'other');--> statement-breakpoint
CREATE TYPE "public"."rider_verification_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "riders" ALTER COLUMN "vehicle_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "riders" ALTER COLUMN "vehicle_type" TYPE "public"."rider_vehicle_type" USING ("vehicle_type"::text::"public"."rider_vehicle_type");--> statement-breakpoint
ALTER TABLE "riders" ALTER COLUMN "vehicle_type" SET DEFAULT 'motorcycle';--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "full_name" varchar(100);--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "profile_image_url" text;--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "date_of_birth" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "license_number" varchar(50);--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "verification_status" "rider_verification_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "availability_status" "rider_availability_status" DEFAULT 'offline' NOT NULL;--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "suspension_reason" text;--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "riders" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "riders" ADD CONSTRAINT "riders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "riders_verification_status_idx" ON "riders" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "riders_availability_status_idx" ON "riders" USING btree ("availability_status");
