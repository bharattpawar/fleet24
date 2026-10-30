ALTER TABLE "deliveries" ADD COLUMN "distance_meters" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "offer_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "last_dispatch_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliveries" ADD COLUMN "dispatch_failure_reason" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "deliveries_offer_expires_at_idx" ON "deliveries" USING btree ("offer_expires_at");