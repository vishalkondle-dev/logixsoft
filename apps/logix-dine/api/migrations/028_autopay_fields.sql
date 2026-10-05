-- Add UPI AutoPay columns to restaurantOutlet table

ALTER TABLE "restaurantOutlet"
  ADD COLUMN IF NOT EXISTS "autopayStatus" text,
  ADD COLUMN IF NOT EXISTS "autopayMandateId" text,
  ADD COLUMN IF NOT EXISTS "autopayUmn" text,
  ADD COLUMN IF NOT EXISTS "autopayNextBillingAt" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "restaurantOutlet_autopayMandateId_idx" ON "restaurantOutlet" ("autopayMandateId");
