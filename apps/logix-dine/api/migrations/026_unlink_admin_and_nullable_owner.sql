-- Migration 026: Unlink platform superadmin from individual restaurants and make ownerUserId nullable
ALTER TABLE "restaurant" ALTER COLUMN "ownerUserId" DROP NOT NULL;

-- Remove any platform superadmin accounts from outletStaff table
DELETE FROM "outletStaff" 
WHERE "userId" IN (SELECT id FROM "user" WHERE role = 'ADMIN')
   OR phone IN (SELECT "phoneNumber" FROM "user" WHERE role = 'ADMIN');

-- Unlink any restaurant ownerUserId pointing to platform superadmin
UPDATE "restaurant"
SET "ownerUserId" = NULL, "updatedAt" = NOW()
WHERE "ownerUserId" IN (SELECT id FROM "user" WHERE role = 'ADMIN');
