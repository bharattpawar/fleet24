ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'payment_conflict';
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_conflict_details" jsonb;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orders_single_active_per_customer_idx" ON "orders" USING btree ("customer_id") WHERE status IN ('placed', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery');
