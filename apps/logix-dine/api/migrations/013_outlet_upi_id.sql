-- Migration: 013_outlet_upi_id.sql
-- Add upiId to restaurantOutlet for custom UPI QR payments

ALTER TABLE "restaurantOutlet" ADD COLUMN IF NOT EXISTS "upiId" text;
