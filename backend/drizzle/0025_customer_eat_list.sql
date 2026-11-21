CREATE TABLE "customer_eat_list_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "outlet_id" uuid REFERENCES "restaurant_outlets"("id") ON DELETE SET NULL,
  "menu_item_id" uuid REFERENCES "menu_items"("id") ON DELETE SET NULL,
  "dish_name" varchar(100) NOT NULL,
  "restaurant_name" varchar(100) NOT NULL,
  "outlet_name" varchar(100) NOT NULL,
  "image_url" varchar(2048),
  "is_veg" boolean NOT NULL,
  "saved_price" numeric(10,2) NOT NULL,
  "note" varchar(1000),
  "planned_date" date,
  "planned_time" time(0),
  "time_zone" varchar(64),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "eat_list_time_requires_date" CHECK ("planned_time" IS NULL OR "planned_date" IS NOT NULL),
  CONSTRAINT "eat_list_plan_requires_zone" CHECK ("planned_date" IS NULL OR "time_zone" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "eat_list_user_dish_outlet_unique" ON "customer_eat_list_items" ("user_id", "outlet_id", "menu_item_id");
--> statement-breakpoint
CREATE INDEX "eat_list_user_saved_idx" ON "customer_eat_list_items" ("user_id", "created_at" DESC, "id" DESC);
--> statement-breakpoint
CREATE INDEX "eat_list_user_plan_idx" ON "customer_eat_list_items" ("user_id", "planned_date", coalesce("planned_time", '23:59:59'::time), "id");
--> statement-breakpoint
ALTER TABLE "customer_eat_list_items" ENABLE ROW LEVEL SECURITY;
-- No public/anon policies: private notes are served only by the authenticated backend.
