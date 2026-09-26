-- Migration 022: Add adjustments column to saleOrder
ALTER TABLE "saleOrder" ADD COLUMN IF NOT EXISTS "adjustments" jsonb DEFAULT '[]'::jsonb;
