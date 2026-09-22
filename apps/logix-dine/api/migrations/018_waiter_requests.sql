-- Migration: 018_waiter_requests.sql
-- Waiter requests and floor assistance management

CREATE TABLE IF NOT EXISTS "waiterRequest" (
  "id" text PRIMARY KEY,
  "restaurantId" text NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "outletId" text NOT NULL REFERENCES "restaurantOutlet"("id") ON DELETE CASCADE,
  "orderId" text REFERENCES "saleOrder"("id") ON DELETE SET NULL,
  "tableNo" text NOT NULL,
  "serviceType" text NOT NULL,
  "serviceLabel" text NOT NULL,
  "note" text,
  "customerPhone" text,
  "status" text NOT NULL DEFAULT 'PENDING',
  "completedAt" timestamp,
  "completedBy" text,
  "completedByRole" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "createdBy" text,
  "updatedBy" text
);

CREATE INDEX IF NOT EXISTS "waiterRequest_restaurantId_status_idx" ON "waiterRequest"("restaurantId", "status");
CREATE INDEX IF NOT EXISTS "waiterRequest_outletId_status_idx" ON "waiterRequest"("outletId", "status");
CREATE INDEX IF NOT EXISTS "waiterRequest_outletId_idx" ON "waiterRequest"("outletId");
CREATE INDEX IF NOT EXISTS "waiterRequest_createdAt_idx" ON "waiterRequest"("createdAt");
