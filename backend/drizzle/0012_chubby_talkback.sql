CREATE TYPE "public"."restaurant_verification_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurant_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"document_number" varchar(100),
	"document_url" text NOT NULL,
	"storage_provider" varchar(30) DEFAULT 's3_compatible' NOT NULL,
	"storage_key" varchar(255),
	"verification_status" varchar(30) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blocked_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blocked_by" uuid;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "verification_status" "restaurant_verification_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "suspension_reason" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "verified_by" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurant_documents" ADD CONSTRAINT "restaurant_documents_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurant_documents_restaurant_id_idx" ON "restaurant_documents" USING btree ("restaurant_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_blocked_by_users_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurants_verification_status_idx" ON "restaurants" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurants_owner_id_idx" ON "restaurants" USING btree ("owner_id");