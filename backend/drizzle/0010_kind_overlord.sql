CREATE TYPE "public"."assignment_attempt_status" AS ENUM('offered', 'accepted', 'rejected', 'expired');--> statement-breakpoint
ALTER TYPE "public"."delivery_status" ADD VALUE 'accepted' BEFORE 'at_restaurant';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_assignment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"delivery_id" uuid NOT NULL,
	"rider_id" uuid NOT NULL,
	"status" "assignment_attempt_status" DEFAULT 'offered' NOT NULL,
	"distance_meters" numeric(10, 2),
	"offered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"rejection_reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_assignment_attempts" ADD CONSTRAINT "delivery_assignment_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_assignment_attempts" ADD CONSTRAINT "delivery_assignment_attempts_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "delivery_assignment_attempts" ADD CONSTRAINT "delivery_assignment_attempts_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_assignment_attempts_order_id_idx" ON "delivery_assignment_attempts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_assignment_attempts_delivery_id_idx" ON "delivery_assignment_attempts" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_assignment_attempts_rider_id_idx" ON "delivery_assignment_attempts" USING btree ("rider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_assignment_attempts_status_idx" ON "delivery_assignment_attempts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_assignment_attempts_order_rider_offered_idx" ON "delivery_assignment_attempts" USING btree ("order_id","rider_id","offered_at");