-- Restaurant discount on a single dish (percentage or flat rupees off)
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "discount_type" "promo_type";
--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "discount_value" numeric(10, 2);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_discount_check" CHECK (
  ("discount_type" IS NULL AND "discount_value" IS NULL)
  OR ("discount_type" = 'percentage' AND "discount_value" > 0 AND "discount_value" <= 90)
  OR ("discount_type" = 'fixed_amount' AND "discount_value" > 0)
 );
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Coupon code the customer applied to the cart (admin promotions)
ALTER TABLE "customer_carts" ADD COLUMN IF NOT EXISTS "promotion_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_carts" ADD CONSTRAINT "customer_carts_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
