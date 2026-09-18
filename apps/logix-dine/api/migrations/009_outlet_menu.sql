-- =============================================================================
-- 009_outlet_menu.sql
-- Logix Dine — Link Menu Categories and Items to Outlet
-- Apply: sudo -u postgres psql -p 5432 -d payment -f 009_outlet_menu.sql
-- =============================================================================

ALTER TABLE "menuCategory" ADD COLUMN IF NOT EXISTS "outletId" text REFERENCES "restaurantOutlet"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "menuCategory_outletId_idx" ON "menuCategory"("outletId");

ALTER TABLE "menuItem" ADD COLUMN IF NOT EXISTS "outletId" text REFERENCES "restaurantOutlet"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "menuItem_outletId_idx" ON "menuItem"("outletId");

-- Backfill existing categories with the default outlet of their restaurant
UPDATE "menuCategory" c
SET "outletId" = o.id
FROM "restaurantOutlet" o
WHERE c."restaurantId" = o."restaurantId"
  AND o."isDefault" = true
  AND c."outletId" IS NULL;

-- If any categories still don't have outletId, fallback to any outlet of that restaurant
UPDATE "menuCategory" c
SET "outletId" = o.id
FROM (
  SELECT DISTINCT ON ("restaurantId") id, "restaurantId"
  FROM "restaurantOutlet"
  ORDER BY "restaurantId", "createdAt" ASC
) o
WHERE c."restaurantId" = o."restaurantId"
  AND c."outletId" IS NULL;

-- Backfill items from their category's outletId
UPDATE "menuItem" m
SET "outletId" = c."outletId"
FROM "menuCategory" c
WHERE m."categoryId" = c.id
  AND m."outletId" IS NULL;
