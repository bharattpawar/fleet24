-- Restaurant self-registration: details an owner submits from the restaurant app for admin review.
CREATE TABLE IF NOT EXISTS "restaurant_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"applicant_user_id" uuid,
	"owner_name" varchar(100) NOT NULL,
	"owner_email" varchar(255),
	"contact_phone" varchar(20) NOT NULL,
	"cuisines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fssai_number" varchar(14) NOT NULL,
	"fssai_expiry" date,
	"pan_number" varchar(10) NOT NULL,
	"gstin" varchar(15),
	"bank_account_holder" varchar(100) NOT NULL,
	"bank_account_number" varchar(20) NOT NULL,
	"bank_ifsc" varchar(11) NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurant_applications" ADD CONSTRAINT "restaurant_applications_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurant_applications" ADD CONSTRAINT "restaurant_applications_applicant_user_id_users_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "restaurant_applications_restaurant_id_idx" ON "restaurant_applications" USING btree ("restaurant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurant_applications_applicant_idx" ON "restaurant_applications" USING btree ("applicant_user_id");
