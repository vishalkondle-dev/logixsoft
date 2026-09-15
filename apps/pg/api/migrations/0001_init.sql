-- Better-Auth core tables for Logixsoft PG
CREATE TABLE IF NOT EXISTS "user" (
  "id"            text PRIMARY KEY,
  "name"          text NOT NULL,
  "email"         text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image"         text,
  "role"          text NOT NULL DEFAULT 'MERCHANT',
  "createdAt"     timestamp NOT NULL DEFAULT now(),
  "updatedAt"     timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id"        text PRIMARY KEY,
  "expiresAt" timestamp NOT NULL,
  "token"     text NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId"    text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id"                    text PRIMARY KEY,
  "accountId"             text NOT NULL,
  "providerId"            text NOT NULL,
  "userId"                text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope"                 text,
  "password"              text,
  "createdAt"             timestamp NOT NULL DEFAULT now(),
  "updatedAt"             timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id"         text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value"      text NOT NULL,
  "expiresAt"  timestamp NOT NULL,
  "createdAt"  timestamp NOT NULL DEFAULT now(),
  "updatedAt"  timestamp NOT NULL DEFAULT now()
);

-- Payment Gateway Tables
CREATE TABLE IF NOT EXISTS "pg_credential" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "activeProvider" text NOT NULL DEFAULT 'MOCK',
  "phonepeMerchantId" text,
  "phonepeSaltKey" text,
  "phonepeSaltIndex" text DEFAULT '1',
  "phonepeEnv" text NOT NULL DEFAULT 'UAT',
  "paytmMerchantId" text,
  "paytmMerchantKey" text,
  "paytmWebsite" text DEFAULT 'DEFAULT',
  "paytmEnv" text NOT NULL DEFAULT 'STAGING',
  "vpa" text,
  "merchantName" text DEFAULT 'Logixsoft Merchant',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "pg_credential_userId_idx" ON "pg_credential" ("userId");

CREATE TABLE IF NOT EXISTS "payment_order" (
  "id" text PRIMARY KEY,
  "orderId" text NOT NULL UNIQUE,
  "merchantId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "amount" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'INR',
  "status" text NOT NULL DEFAULT 'PENDING',
  "provider" text NOT NULL DEFAULT 'MOCK',
  "customerName" text,
  "customerEmail" text,
  "customerPhone" text,
  "description" text,
  "upiString" text,
  "providerReferenceId" text,
  "bankReferenceNo" text,
  "paymentMode" text,
  "failureReason" text,
  "metadata" text,
  "expiresAt" timestamp,
  "paidAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "payment_order_orderId_idx" ON "payment_order" ("orderId");
CREATE INDEX IF NOT EXISTS "payment_order_merchantId_idx" ON "payment_order" ("merchantId");
CREATE INDEX IF NOT EXISTS "payment_order_status_idx" ON "payment_order" ("status");
CREATE INDEX IF NOT EXISTS "payment_order_createdAt_idx" ON "payment_order" ("createdAt");

CREATE TABLE IF NOT EXISTS "webhook_log" (
  "id" text PRIMARY KEY,
  "provider" text NOT NULL,
  "orderId" text,
  "payload" text NOT NULL,
  "headers" text,
  "status" text NOT NULL DEFAULT 'PROCESSED',
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "webhook_log_orderId_idx" ON "webhook_log" ("orderId");
CREATE INDEX IF NOT EXISTS "webhook_log_createdAt_idx" ON "webhook_log" ("createdAt");

CREATE TABLE IF NOT EXISTS "api_key" (
  "id" text PRIMARY KEY,
  "merchantId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "key" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "lastUsedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "api_key_merchantId_idx" ON "api_key" ("merchantId");
CREATE INDEX IF NOT EXISTS "api_key_key_idx" ON "api_key" ("key");

-- Insert default demo merchant if user does not exist
INSERT INTO "user" ("id", "name", "email", "emailVerified", "role")
VALUES ('default-merchant', 'Demo Merchant', 'merchant@logixsoft.in', true, 'MERCHANT')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "pg_credential" ("id", "userId", "activeProvider", "vpa", "merchantName")
VALUES ('default-cred', 'default-merchant', 'MOCK', 'merchant@upi', 'Demo Merchant Store')
ON CONFLICT ("id") DO NOTHING;

