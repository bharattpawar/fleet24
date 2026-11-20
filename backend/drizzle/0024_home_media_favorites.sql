CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sha256" varchar(64) NOT NULL UNIQUE,
  "mime_type" varchar(20) NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "size_bytes" integer NOT NULL,
  "data" bytea NOT NULL,
  "original_name" varchar(200),
  "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_favorite_outlets" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "outlet_id" uuid NOT NULL REFERENCES "restaurant_outlets"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "outlet_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_favorite_outlets_user_idx" ON "customer_favorite_outlets" ("user_id");
