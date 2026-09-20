-- Migration 015: Add imageUrl to menuItem

ALTER TABLE "menuItem"
  ADD COLUMN IF NOT EXISTS "imageUrl" text;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO payment_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO payment_user;
