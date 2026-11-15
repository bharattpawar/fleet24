CREATE TABLE "customer_home" (
  "id" integer PRIMARY KEY CHECK ("id" = 1),
  "draft" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "published" jsonb DEFAULT '[]'::jsonb NOT NULL
);
