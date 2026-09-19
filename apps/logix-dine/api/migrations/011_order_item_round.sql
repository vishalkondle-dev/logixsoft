-- 011_order_item_round.sql
-- Add round column to saleOrderItem to support multiple rounds of ordering for tables.

BEGIN;

ALTER TABLE "saleOrderItem"
  ADD COLUMN IF NOT EXISTS "round" integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "saleOrderItem_orderId_round_idx"
  ON "saleOrderItem"("orderId", "round");

COMMIT;
