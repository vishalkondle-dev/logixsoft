-- Migration: 017_outlet_invoice_and_tax.sql
-- Add invoiceSettings and taxSettings jsonb columns to restaurantOutlet

ALTER TABLE "restaurantOutlet" ADD COLUMN IF NOT EXISTS "invoiceSettings" jsonb;
ALTER TABLE "restaurantOutlet" ADD COLUMN IF NOT EXISTS "taxSettings" jsonb;
