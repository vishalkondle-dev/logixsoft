-- 007_order_item_note.sql
-- Add optional note column to saleOrderItem for special cooking/preparation instructions

BEGIN;

ALTER TABLE "saleOrderItem"
  ADD COLUMN IF NOT EXISTS "note" text;

COMMIT;
