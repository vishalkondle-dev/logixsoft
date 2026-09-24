-- Migration: 020_settings_and_reservations.sql
-- Add diningSettings, qrMenuSettings, whatsappSettings jsonb columns to restaurantOutlet
ALTER TABLE "restaurantOutlet" ADD COLUMN IF NOT EXISTS "diningSettings" jsonb;
ALTER TABLE "restaurantOutlet" ADD COLUMN IF NOT EXISTS "qrMenuSettings" jsonb;
ALTER TABLE "restaurantOutlet" ADD COLUMN IF NOT EXISTS "whatsappSettings" jsonb;

-- Table Reservations
CREATE TABLE IF NOT EXISTS "tableReservation" (
  "id" text PRIMARY KEY,
  "restaurantId" text NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "outletId" text NOT NULL REFERENCES "restaurantOutlet"("id") ON DELETE CASCADE,
  "tableId" text REFERENCES "posTable"("id") ON DELETE SET NULL,
  "tableName" text,
  "guestName" text NOT NULL,
  "guestPhone" text NOT NULL,
  "guestEmail" text,
  "partySize" integer NOT NULL DEFAULT 2,
  "reservationDate" text NOT NULL,
  "startTime" text NOT NULL,
  "endTime" text,
  "status" text NOT NULL DEFAULT 'CONFIRMED',
  "notes" text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "createdBy" text,
  "updatedBy" text
);

CREATE INDEX IF NOT EXISTS "tableReservation_restaurantId_idx" ON "tableReservation"("restaurantId");
CREATE INDEX IF NOT EXISTS "tableReservation_outletId_idx" ON "tableReservation"("outletId");
CREATE INDEX IF NOT EXISTS "tableReservation_date_idx" ON "tableReservation"("reservationDate");
CREATE INDEX IF NOT EXISTS "tableReservation_status_idx" ON "tableReservation"("status");
