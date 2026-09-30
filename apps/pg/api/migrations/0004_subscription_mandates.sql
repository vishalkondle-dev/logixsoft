-- UPI AutoPay and Recurring Mandates for Logix PG

CREATE TABLE IF NOT EXISTS "subscription_mandate" (
  "id"                     text PRIMARY KEY,
  "mandateId"              text NOT NULL UNIQUE,
  "merchantId"             text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "customerPhone"          text NOT NULL,
  "customerName"           text,
  "customerVpa"            text,
  "mandateName"            text NOT NULL,
  "maxAmount"              integer NOT NULL DEFAULT 1500000, -- Amount cap in paise (e.g. 15,000 INR)
  "recurringAmount"        integer NOT NULL,                 -- Amount per cycle in paise (e.g. 1,499 INR = 149900)
  "frequency"              text NOT NULL DEFAULT 'MONTHLY',  -- 'MONTHLY' | 'ANNUAL' | 'ASPRESENTED'
  "status"                 text NOT NULL DEFAULT 'PENDING',  -- 'PENDING' | 'ACTIVE' | 'PAUSED' | 'REVOKED' | 'EXPIRED'
  "provider"               text NOT NULL DEFAULT 'MOCK',     -- 'PAYTM' | 'MOCK'
  "providerSubscriptionId" text,
  "umn"                    text,                             -- Unique Mandate Number from NPCI
  "upiString"              text,                             -- upi://mandate URI string
  "metadata"               text,                             -- JSON encoded metadata (e.g. { outletId, restaurantId, planTier })
  "nextBillingDate"        timestamp,
  "lastDebitedAt"          timestamp,
  "createdAt"              timestamp NOT NULL DEFAULT now(),
  "updatedAt"              timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_mandate_mandateId_idx" ON "subscription_mandate" ("mandateId");
CREATE INDEX IF NOT EXISTS "subscription_mandate_merchantId_idx" ON "subscription_mandate" ("merchantId");
CREATE INDEX IF NOT EXISTS "subscription_mandate_status_idx" ON "subscription_mandate" ("status");
CREATE INDEX IF NOT EXISTS "subscription_mandate_customerPhone_idx" ON "subscription_mandate" ("customerPhone");

CREATE TABLE IF NOT EXISTS "subscription_charge" (
  "id"                     text PRIMARY KEY,
  "chargeId"               text NOT NULL UNIQUE,
  "mandateId"              text NOT NULL REFERENCES "subscription_mandate"("mandateId") ON DELETE CASCADE,
  "merchantId"             text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "amount"                 integer NOT NULL,                 -- Amount in paise
  "status"                 text NOT NULL DEFAULT 'PENDING',  -- 'PRE_NOTIFIED' | 'PENDING' | 'SUCCESS' | 'FAILED'
  "preDebitSentAt"         timestamp,
  "debitedAt"              timestamp,
  "providerReferenceId"    text,
  "bankReferenceNo"        text,
  "failureReason"          text,
  "createdAt"              timestamp NOT NULL DEFAULT now(),
  "updatedAt"              timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_charge_chargeId_idx" ON "subscription_charge" ("chargeId");
CREATE INDEX IF NOT EXISTS "subscription_charge_mandateId_idx" ON "subscription_charge" ("mandateId");
CREATE INDEX IF NOT EXISTS "subscription_charge_status_idx" ON "subscription_charge" ("status");
