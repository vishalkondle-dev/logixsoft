-- Migration: 016_outlet_opening_hours.sql
-- Add openingHours jsonb column to restaurantOutlet for Store Hours configuration

ALTER TABLE "restaurantOutlet" ADD COLUMN IF NOT EXISTS "openingHours" jsonb;
