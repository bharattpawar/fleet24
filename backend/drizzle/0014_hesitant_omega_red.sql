CREATE TYPE "public"."commission_basis" AS ENUM('item_total', 'item_total_minus_discounts', 'total_payable');--> statement-breakpoint
CREATE TYPE "public"."financial_settings_status" AS ENUM('draft', 'scheduled', 'active', 'superseded', 'archived');--> statement-breakpoint
CREATE TYPE "public"."rider_earning_strategy" AS ENUM('fixed_per_delivery', 'distance_rate', 'base_plus_distance', 'distance_slabs');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_settings" (
	"id" varchar(50) PRIMARY KEY DEFAULT 'global' NOT NULL,
	"active_version_id" uuid NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_settings_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_number" integer NOT NULL,
	"status" "financial_settings_status" DEFAULT 'draft' NOT NULL,
	"settings_payload" jsonb NOT NULL,
	"change_reason" text,
	"effective_from" timestamp with time zone,
	"effective_until" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurant_monthly_delivery_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"period_month_year" varchar(7) NOT NULL,
	"allocated_credits" integer DEFAULT 150 NOT NULL,
	"used_credits" integer DEFAULT 0 NOT NULL,
	"additional_deliveries_count" integer DEFAULT 0 NOT NULL,
	"additional_per_delivery_fee" numeric(10, 2) DEFAULT '25.00' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"is_expired" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_settings" ADD CONSTRAINT "financial_settings_active_version_id_financial_settings_versions_id_fk" FOREIGN KEY ("active_version_id") REFERENCES "public"."financial_settings_versions"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_settings" ADD CONSTRAINT "financial_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_settings_versions" ADD CONSTRAINT "financial_settings_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_settings_versions" ADD CONSTRAINT "financial_settings_versions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurant_monthly_delivery_credits" ADD CONSTRAINT "restaurant_monthly_delivery_credits_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "financial_settings_versions_version_idx" ON "financial_settings_versions" USING btree ("version_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_settings_versions_status_idx" ON "financial_settings_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_settings_versions_effective_idx" ON "financial_settings_versions" USING btree ("effective_from","effective_until");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "restaurant_credits_restaurant_period_idx" ON "restaurant_monthly_delivery_credits" USING btree ("restaurant_id","period_month_year");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurant_credits_restaurant_id_idx" ON "restaurant_monthly_delivery_credits" USING btree ("restaurant_id");