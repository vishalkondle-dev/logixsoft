-- 010_order_item_status_audit.sql
-- Add order item status lifecycle (ORDERED, PREPARING, PREPARED, SERVED, CANCELLED),
-- derived orderStatus on saleOrder, and orderItemAudit table for tracking staff changes.

BEGIN;

-- 1. Add status and updatedAt to saleOrderItem
ALTER TABLE "saleOrderItem"
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'ORDERED',
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS "saleOrderItem_orderId_status_idx"
  ON "saleOrderItem"("orderId", "status");

-- 2. Add orderStatus to saleOrder
ALTER TABLE "saleOrder"
  ADD COLUMN IF NOT EXISTS "orderStatus" text NOT NULL DEFAULT 'ORDERED';

CREATE INDEX IF NOT EXISTS "saleOrder_restaurantId_orderStatus_idx"
  ON "saleOrder"("restaurantId", "orderStatus");

CREATE INDEX IF NOT EXISTS "saleOrder_outletId_orderStatus_idx"
  ON "saleOrder"("outletId", "orderStatus");

-- 3. Create orderItemAudit table
CREATE TABLE IF NOT EXISTS "orderItemAudit" (
  "id" text PRIMARY KEY,
  "orderId" text NOT NULL REFERENCES "saleOrder"("id") ON DELETE CASCADE,
  "orderItemId" text NOT NULL REFERENCES "saleOrderItem"("id") ON DELETE CASCADE,
  "fromStatus" text,
  "toStatus" text NOT NULL,
  "changedBy" text,
  "changedByRole" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "orderItemAudit_orderItemId_idx"
  ON "orderItemAudit"("orderItemId");

CREATE INDEX IF NOT EXISTS "orderItemAudit_orderId_idx"
  ON "orderItemAudit"("orderId");

-- 4. Backfill existing rows
UPDATE "saleOrder"
SET "orderStatus" = 'SERVED'
WHERE "status" = 'PAID';

UPDATE "saleOrderItem"
SET "status" = 'SERVED'
WHERE "orderId" IN (SELECT "id" FROM "saleOrder" WHERE "status" = 'PAID');

UPDATE "saleOrder"
SET "orderStatus" = 'CANCELLED'
WHERE "status" = 'VOID';

UPDATE "saleOrderItem"
SET "status" = 'CANCELLED'
WHERE "orderId" IN (SELECT "id" FROM "saleOrder" WHERE "status" = 'VOID');

UPDATE "saleOrder"
SET "orderStatus" = 'PREPARED'
WHERE "status" = 'OPEN' AND "readyAt" IS NOT NULL;

UPDATE "saleOrderItem"
SET "status" = 'PREPARED'
WHERE "orderId" IN (SELECT "id" FROM "saleOrder" WHERE "status" = 'OPEN' AND "readyAt" IS NOT NULL);

COMMIT;
