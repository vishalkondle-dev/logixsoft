-- ─── 025: Outlet Staff Direct Provisioning ──────────────────────────────────
-- Transition from legacy 2-tier "SaaS Invite & Accept" model
-- (restaurantMember + memberOutletAccess + inviteStatus) to Direct Staff Provisioning:
-- 1. Create "outletStaff" table.
-- 2. Migrate existing restaurantMember rows (Owner and existing staff).
-- 3. Drop legacy tables "memberOutletAccess" and "restaurantMember".

CREATE TABLE IF NOT EXISTS "outletStaff" (
  "id"           text PRIMARY KEY,
  "restaurantId" text NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "outletId"     text REFERENCES "restaurantOutlet"("id") ON DELETE CASCADE,
  "userId"       text REFERENCES "user"("id") ON DELETE SET NULL,
  "phone"        text NOT NULL,
  "name"         text,
  "role"         text NOT NULL,
  "status"       text NOT NULL DEFAULT 'ACTIVE',
  "createdAt"    timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt"    timestamp with time zone NOT NULL DEFAULT now(),
  "createdBy"    text,
  "updatedBy"    text
);

CREATE INDEX IF NOT EXISTS "outletStaff_restaurantId_idx" ON "outletStaff"("restaurantId");
CREATE INDEX IF NOT EXISTS "outletStaff_outletId_idx"     ON "outletStaff"("outletId");
CREATE INDEX IF NOT EXISTS "outletStaff_phone_idx"        ON "outletStaff"("phone");
CREATE INDEX IF NOT EXISTS "outletStaff_userId_idx"       ON "outletStaff"("userId");

-- Migrate existing members
INSERT INTO "outletStaff" ("id", "restaurantId", "outletId", "userId", "phone", "name", "role", "status", "createdAt", "updatedAt", "createdBy", "updatedBy")
SELECT 
  rm.id,
  rm."restaurantId",
  moa."outletId",
  rm."userId",
  rm.phone,
  u.name,
  rm.role,
  'ACTIVE',
  rm."createdAt",
  rm."updatedAt",
  rm."createdBy",
  rm."updatedBy"
FROM "restaurantMember" rm
LEFT JOIN "memberOutletAccess" moa ON moa."memberId" = rm.id
LEFT JOIN "user" u ON u.id = rm."userId"
ON CONFLICT ("id") DO NOTHING;

-- Drop legacy tables
DROP TABLE IF EXISTS "memberOutletAccess";
DROP TABLE IF EXISTS "restaurantMember";
