-- v3 migration: staff roles, outlet-scoped access, table registry, audit columns, KDS
-- Idempotent: safe to re-run (IF NOT EXISTS / IF EXISTS guards throughout).
-- Run with: sudo -u postgres psql -p 5432 -d payment -f 005_v3_staff_kds_reports.sql

BEGIN;

-- ─── 1. Audit columns on existing POS tables (all nullable — no data loss) ────

ALTER TABLE "restaurant"
  ADD COLUMN IF NOT EXISTS "createdBy" text,
  ADD COLUMN IF NOT EXISTS "updatedBy" text;

ALTER TABLE "restaurantOutlet"
  ADD COLUMN IF NOT EXISTS "createdBy" text,
  ADD COLUMN IF NOT EXISTS "updatedBy" text;

ALTER TABLE "menuCategory"
  ADD COLUMN IF NOT EXISTS "createdBy" text,
  ADD COLUMN IF NOT EXISTS "updatedBy" text;

ALTER TABLE "menuItem"
  ADD COLUMN IF NOT EXISTS "createdBy" text,
  ADD COLUMN IF NOT EXISTS "updatedBy" text;

ALTER TABLE "saleOrder"
  ADD COLUMN IF NOT EXISTS "readyAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "createdBy" text,
  ADD COLUMN IF NOT EXISTS "updatedBy" text;

ALTER TABLE "saleOrderItem"
  ADD COLUMN IF NOT EXISTS "createdBy" text,
  ADD COLUMN IF NOT EXISTS "updatedBy" text;

-- ─── 2. restaurantMember: staff invite support ────────────────────────────────
-- phone: denormalised — lets us match an invite to a user BEFORE they've
--        ever logged in (userId is null until then).
-- inviteStatus: PENDING (invited, never logged in) | ACCEPTED (linked to a user).
-- userId: relax NOT NULL so a PENDING row can exist without a user yet.
-- updatedAt: was missing entirely in v2.

ALTER TABLE "restaurantMember"
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "createdBy" text,
  ADD COLUMN IF NOT EXISTS "updatedBy" text,
  ADD COLUMN IF NOT EXISTS "phone" text,
  ADD COLUMN IF NOT EXISTS "inviteStatus" text NOT NULL DEFAULT 'ACCEPTED';

-- Backfill phone on existing member rows from the user table (all v2 rows have a userId)
UPDATE "restaurantMember" rm
SET "phone" = u."phoneNumber"
FROM "user" u
WHERE rm."userId" = u.id AND rm."phone" IS NULL;

-- Any stragglers with no matching user (shouldn't exist, but guard anyway)
UPDATE "restaurantMember" SET "phone" = '' WHERE "phone" IS NULL;

ALTER TABLE "restaurantMember" ALTER COLUMN "phone" SET NOT NULL;
ALTER TABLE "restaurantMember" ALTER COLUMN "userId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "restaurantMember_phone_idx" ON "restaurantMember" ("phone");

-- ─── 3. memberOutletAccess: many-to-many member <-> outlet ────────────────────
-- OWNER has zero rows here (means "all outlets" — checked in app code).
-- MANAGER / WAITER / KITCHEN need one row per outlet they can access.

CREATE TABLE IF NOT EXISTS "memberOutletAccess" (
  "id" text PRIMARY KEY,
  "memberId" text NOT NULL REFERENCES "restaurantMember"(id) ON DELETE CASCADE,
  "outletId" text NOT NULL REFERENCES "restaurantOutlet"(id) ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "createdBy" text,
  CONSTRAINT "memberOutletAccess_memberId_outletId_uniq" UNIQUE ("memberId", "outletId")
);

CREATE INDEX IF NOT EXISTS "memberOutletAccess_memberId_idx" ON "memberOutletAccess" ("memberId");
CREATE INDEX IF NOT EXISTS "memberOutletAccess_outletId_idx" ON "memberOutletAccess" ("outletId");

-- ─── 4. posTable: dine-in table registry ──────────────────────────────────────
-- saleOrder.tableNo remains a point-in-time NAME SNAPSHOT — tables can be
-- renamed/deactivated later without corrupting historical order records.

CREATE TABLE IF NOT EXISTS "posTable" (
  "id" text PRIMARY KEY,
  "restaurantId" text NOT NULL REFERENCES "restaurant"(id) ON DELETE CASCADE,
  "outletId" text NOT NULL REFERENCES "restaurantOutlet"(id) ON DELETE CASCADE,
  "name" text NOT NULL,
  "section" text,
  "capacity" integer,
  "active" boolean NOT NULL DEFAULT true,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "createdBy" text,
  "updatedBy" text,
  CONSTRAINT "posTable_outletId_name_uniq" UNIQUE ("outletId", "name")
);

CREATE INDEX IF NOT EXISTS "posTable_outletId_idx" ON "posTable" ("outletId");

COMMIT;
