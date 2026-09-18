-- 006_customer_phone.sql
-- Add optional customer phone number to saleOrder for WhatsApp notifications

BEGIN;

ALTER TABLE "saleOrder"
  ADD COLUMN IF NOT EXISTS "customerPhone" text;

COMMIT;
