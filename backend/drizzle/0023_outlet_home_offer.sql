-- Customer home: admin-edited discount text and cover photo per outlet (all optional).
ALTER TABLE "restaurant_outlets" ADD COLUMN IF NOT EXISTS "offer_title" varchar(30);
--> statement-breakpoint
ALTER TABLE "restaurant_outlets" ADD COLUMN IF NOT EXISTS "offer_subtitle" varchar(30);
--> statement-breakpoint
ALTER TABLE "restaurant_outlets" ADD COLUMN IF NOT EXISTS "cover_image_url" text;
