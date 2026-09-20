-- Migration 014: Add variants and addons to menuItem and saleOrderItem

ALTER TABLE "menuItem"
  ADD COLUMN IF NOT EXISTS "variants" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "addons" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "saleOrderItem"
  ADD COLUMN IF NOT EXISTS "variant" jsonb,
  ADD COLUMN IF NOT EXISTS "addons" jsonb NOT NULL DEFAULT '[]'::jsonb;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO payment_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO payment_user;
