-- =============================================================================
-- 004_pos_billing.sql
-- Logix Dine — Multi-tenant POS billing tables
-- Apply: sudo -u postgres psql -p 5432 -d payment -f 004_pos_billing.sql
-- =============================================================================

-- ─── restaurant ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "restaurant" (
  "id"           text        PRIMARY KEY,
  "name"         text        NOT NULL,
  "address"      text        NOT NULL,
  "phone"        text,
  "currency"     text        NOT NULL DEFAULT 'INR',
  "status"       text        NOT NULL DEFAULT 'TRIAL',
  "ownerUserId"  text        NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt"    timestamptz NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "restaurant_ownerUserId_idx" ON "restaurant"("ownerUserId");

-- ─── restaurantMember ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "restaurantMember" (
  "id"           text        PRIMARY KEY,
  "restaurantId" text        NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "userId"       text        NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role"         text        NOT NULL,
  "createdAt"    timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("restaurantId", "userId")
);
CREATE INDEX IF NOT EXISTS "restaurantMember_restaurantId_idx" ON "restaurantMember"("restaurantId");
CREATE INDEX IF NOT EXISTS "restaurantMember_userId_idx"       ON "restaurantMember"("userId");

-- ─── restaurantOutlet ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "restaurantOutlet" (
  "id"           text        PRIMARY KEY,
  "restaurantId" text        NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "name"         text        NOT NULL,
  "address"      text,
  "phone"        text,
  "isDefault"    boolean     NOT NULL DEFAULT false,
  "createdAt"    timestamptz NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "restaurantOutlet_restaurantId_idx" ON "restaurantOutlet"("restaurantId");

-- ─── menuCategory ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "menuCategory" (
  "id"           text        PRIMARY KEY,
  "restaurantId" text        NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "name"         text        NOT NULL,
  "description"  text,
  "sortOrder"    integer     NOT NULL DEFAULT 0,
  "active"       boolean     NOT NULL DEFAULT true,
  "createdAt"    timestamptz NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "menuCategory_restaurantId_idx" ON "menuCategory"("restaurantId");

-- ─── menuItem ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "menuItem" (
  "id"           text        PRIMARY KEY,
  "restaurantId" text        NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "categoryId"   text        NOT NULL REFERENCES "menuCategory"("id") ON DELETE RESTRICT,
  "name"         text        NOT NULL,
  "description"  text,
  "pricePaise"   integer     NOT NULL,
  "available"    boolean     NOT NULL DEFAULT true,
  "sortOrder"    integer     NOT NULL DEFAULT 0,
  "createdAt"    timestamptz NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "menuItem_restaurantId_idx" ON "menuItem"("restaurantId");
CREATE INDEX IF NOT EXISTS "menuItem_categoryId_idx"   ON "menuItem"("categoryId");

-- ─── saleOrder ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "saleOrder" (
  "id"               text        PRIMARY KEY,
  "restaurantId"     text        NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "outletId"         text        NOT NULL REFERENCES "restaurantOutlet"("id") ON DELETE RESTRICT,
  "orderNo"          integer     NOT NULL,
  "tableNo"          text,
  "status"           text        NOT NULL DEFAULT 'OPEN',
  "subtotalPaise"    integer     NOT NULL DEFAULT 0,
  "method"           text,
  "note"             text,
  "kotPrintedAt"     timestamptz,
  "settledAt"        timestamptz,
  "settledByUserId"  text        REFERENCES "user"("id"),
  "createdAt"        timestamptz NOT NULL DEFAULT now(),
  "updatedAt"        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "saleOrder_restaurantId_status_idx" ON "saleOrder"("restaurantId", "status");
CREATE INDEX IF NOT EXISTS "saleOrder_outletId_idx"            ON "saleOrder"("outletId");

-- ─── saleOrderItem ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "saleOrderItem" (
  "id"                  text        PRIMARY KEY,
  "orderId"             text        NOT NULL REFERENCES "saleOrder"("id") ON DELETE CASCADE,
  "itemId"              text        NOT NULL REFERENCES "menuItem"("id") ON DELETE RESTRICT,
  "nameSnapshot"        text        NOT NULL,
  "pricePaiseSnapshot"  integer     NOT NULL,
  "qty"                 integer     NOT NULL,
  "createdAt"           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "saleOrderItem_orderId_idx" ON "saleOrderItem"("orderId");
