-- Migration: 012_table_freed_and_round_payment.sql
-- Allow tables to stay occupied when a round is settled (Settle and Send),
-- tracking paid amounts per order and per item until the table is explicitly freed.

ALTER TABLE "saleOrder" ADD COLUMN IF NOT EXISTS "paidPaise" integer NOT NULL DEFAULT 0;
ALTER TABLE "saleOrder" ADD COLUMN IF NOT EXISTS "tableFreedAt" timestamp with time zone;

ALTER TABLE "saleOrderItem" ADD COLUMN IF NOT EXISTS "paymentStatus" text NOT NULL DEFAULT 'UNPAID';
ALTER TABLE "saleOrderItem" ADD COLUMN IF NOT EXISTS "settledMethod" text;
ALTER TABLE "saleOrderItem" ADD COLUMN IF NOT EXISTS "settledAt" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "saleOrder_tableFreedAt_idx" ON "saleOrder" ("tableFreedAt");
CREATE INDEX IF NOT EXISTS "saleOrderItem_paymentStatus_idx" ON "saleOrderItem" ("paymentStatus");
