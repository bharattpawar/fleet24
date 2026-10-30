ALTER TABLE "refunds" ADD COLUMN "idempotency_key" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "operation_key" varchar(100);--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "request_payload" jsonb;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "attempt_count" numeric(5, 0) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "last_error_code" varchar(100);--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "last_error_message" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "refunds_idempotency_key_idx" ON "refunds" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "refunds_operation_key_idx" ON "refunds" USING btree ("operation_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refunds_provider_refund_id_idx" ON "refunds" USING btree ("provider_refund_id");