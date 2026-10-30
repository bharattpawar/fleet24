CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(100) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"provider" varchar(30) DEFAULT 'razorpay' NOT NULL,
	"payload" jsonb,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhook_events_event_id_idx" ON "payment_webhook_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_webhook_events_type_idx" ON "payment_webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_provider_order_id_idx" ON "payments" USING btree ("provider_order_id");