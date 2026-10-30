CREATE TYPE "public"."ledger_direction" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TYPE "public"."ledger_entity_type" AS ENUM('rider', 'restaurant', 'platform', 'customer');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('order_payment', 'rider_delivery_earning', 'rider_incentive', 'rider_payout', 'rider_payout_reversal', 'restaurant_order_credit', 'restaurant_commission_debit', 'restaurant_settlement', 'restaurant_settlement_reversal', 'customer_refund_debit', 'manual_adjustment');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('requested', 'approved', 'rejected', 'processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'approved', 'processing', 'settled', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_reference" varchar(100) NOT NULL,
	"entity_type" "ledger_entity_type" NOT NULL,
	"entity_id" varchar(100) NOT NULL,
	"order_id" uuid,
	"entry_type" "ledger_entry_type" NOT NULL,
	"direction" "ledger_direction" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"source_reference" varchar(120),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurant_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"gross_order_amount" numeric(12, 2) NOT NULL,
	"commission_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"refund_deductions" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"net_payable_amount" numeric(12, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"status" "settlement_status" DEFAULT 'pending' NOT NULL,
	"settlement_reference" varchar(100),
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"settled_at" timestamp with time zone,
	"failure_reason" text,
	"idempotency_key" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rider_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rider_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"status" "payout_status" DEFAULT 'requested' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"rejected_at" timestamp with time zone,
	"rejected_by_user_id" uuid,
	"rejection_reason" text,
	"processed_at" timestamp with time zone,
	"processed_by_user_id" uuid,
	"provider_transfer_id" varchar(100),
	"failure_reason" text,
	"idempotency_key" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_ledger" ADD CONSTRAINT "financial_ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurant_settlements" ADD CONSTRAINT "restaurant_settlements_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurant_settlements" ADD CONSTRAINT "restaurant_settlements_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rider_payouts" ADD CONSTRAINT "rider_payouts_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rider_payouts" ADD CONSTRAINT "rider_payouts_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rider_payouts" ADD CONSTRAINT "rider_payouts_rejected_by_user_id_users_id_fk" FOREIGN KEY ("rejected_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rider_payouts" ADD CONSTRAINT "rider_payouts_processed_by_user_id_users_id_fk" FOREIGN KEY ("processed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "financial_ledger_idempotency_key_idx" ON "financial_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_ledger_entity_idx" ON "financial_ledger" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_ledger_order_id_idx" ON "financial_ledger" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_ledger_entry_type_idx" ON "financial_ledger" USING btree ("entry_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_ledger_created_at_idx" ON "financial_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "restaurant_settlements_idempotency_key_idx" ON "restaurant_settlements" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurant_settlements_restaurant_id_idx" ON "restaurant_settlements" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurant_settlements_status_idx" ON "restaurant_settlements" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurant_settlements_period_idx" ON "restaurant_settlements" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rider_payouts_idempotency_key_idx" ON "rider_payouts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rider_payouts_rider_id_idx" ON "rider_payouts" USING btree ("rider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rider_payouts_status_idx" ON "rider_payouts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rider_payouts_created_at_idx" ON "rider_payouts" USING btree ("created_at");