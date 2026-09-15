-- 0002_provider_credentials.sql
-- Create normalized provider credentials table where merchant VPA, display name, and keys are scoped to each provider

CREATE TABLE IF NOT EXISTS "pg_provider_credential" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "isActive" boolean NOT NULL DEFAULT false,
  "merchantName" text DEFAULT 'Logixsoft Merchant',
  "vpa" text,
  "merchantId" text,
  "credentials" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "pg_provider_credential_userId_idx" ON "pg_provider_credential" ("userId");
CREATE INDEX IF NOT EXISTS "pg_provider_credential_provider_idx" ON "pg_provider_credential" ("provider");
CREATE UNIQUE INDEX IF NOT EXISTS "pg_provider_credential_user_provider_idx" ON "pg_provider_credential" ("userId", "provider");

-- Migrate existing PAYTM credentials from pg_credential
INSERT INTO "pg_provider_credential" ("id", "userId", "provider", "isActive", "merchantName", "vpa", "merchantId", "credentials", "createdAt", "updatedAt")
SELECT 
  'ppc_paytm_' || id,
  "userId",
  'PAYTM',
  CASE WHEN "activeProvider" = 'PAYTM' THEN true ELSE false END,
  COALESCE("merchantName", 'Logix Software Solutions'),
  "vpa",
  "paytmMerchantId",
  json_build_object(
    'merchantKey', COALESCE("paytmMerchantKey", ''),
    'website', COALESCE("paytmWebsite", 'DEFAULT'),
    'env', COALESCE("paytmEnv", 'PROD')
  )::jsonb,
  "createdAt",
  "updatedAt"
FROM "pg_credential"
WHERE "paytmMerchantId" IS NOT NULL OR "activeProvider" = 'PAYTM'
ON CONFLICT ("userId", "provider") DO NOTHING;

-- Migrate existing MOCK credentials from pg_credential
INSERT INTO "pg_provider_credential" ("id", "userId", "provider", "isActive", "merchantName", "vpa", "merchantId", "credentials", "createdAt", "updatedAt")
SELECT 
  'ppc_mock_' || id,
  "userId",
  'MOCK',
  CASE WHEN "activeProvider" = 'MOCK' THEN true ELSE false END,
  COALESCE("merchantName", 'Demo Merchant Store'),
  'merchant@upi',
  'MOCK_MERCHANT',
  '{}'::jsonb,
  "createdAt",
  "updatedAt"
FROM "pg_credential"
ON CONFLICT ("userId", "provider") DO NOTHING;
