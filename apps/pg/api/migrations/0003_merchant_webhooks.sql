-- 0003_merchant_webhooks.sql
-- Create merchant webhooks table for S2S signed notifications

CREATE TABLE IF NOT EXISTS "merchant_webhook" (
  "id" text PRIMARY KEY,
  "merchantId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "secret" text NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "merchant_webhook_merchantId_unique" UNIQUE ("merchantId")
);

CREATE INDEX IF NOT EXISTS "merchant_webhook_merchantId_idx" ON "merchant_webhook" ("merchantId");
