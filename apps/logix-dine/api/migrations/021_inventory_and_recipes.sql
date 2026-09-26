-- Migration: 021_inventory_and_recipes.sql
-- Add inventorySettings to restaurantOutlet
ALTER TABLE "restaurantOutlet" ADD COLUMN IF NOT EXISTS "inventorySettings" jsonb;

-- 1. Suppliers / Vendors
CREATE TABLE IF NOT EXISTS "inventorySupplier" (
  "id" text PRIMARY KEY,
  "restaurantId" text NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "contactPerson" text,
  "phone" text,
  "email" text,
  "gstin" text,
  "address" text,
  "paymentTerms" text,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "inventorySupplier_restaurantId_idx" ON "inventorySupplier"("restaurantId");

-- 2. Inventory Items (Raw Materials, Ingredients, Packaging)
CREATE TABLE IF NOT EXISTS "inventoryItem" (
  "id" text PRIMARY KEY,
  "restaurantId" text NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "outletId" text NOT NULL REFERENCES "restaurantOutlet"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "sku" text,
  "category" text NOT NULL DEFAULT 'GENERAL',
  "baseUom" text NOT NULL,
  "purchaseUom" text,
  "purchaseConversionFactor" double precision DEFAULT 1,
  "costPerBaseUnitPaise" integer NOT NULL DEFAULT 0,
  "currentStock" double precision NOT NULL DEFAULT 0,
  "lowStockThreshold" double precision DEFAULT 0,
  "idealStock" double precision,
  "supplierId" text REFERENCES "inventorySupplier"("id") ON DELETE SET NULL,
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "createdBy" text,
  "updatedBy" text
);

CREATE INDEX IF NOT EXISTS "inventoryItem_outletId_idx" ON "inventoryItem"("outletId");
CREATE INDEX IF NOT EXISTS "inventoryItem_restaurantId_idx" ON "inventoryItem"("restaurantId");
CREATE INDEX IF NOT EXISTS "inventoryItem_category_idx" ON "inventoryItem"("category");

-- 3. Menu Item Recipes (Bill of Materials / BOM)
CREATE TABLE IF NOT EXISTS "menuItemRecipe" (
  "id" text PRIMARY KEY,
  "restaurantId" text NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "outletId" text REFERENCES "restaurantOutlet"("id") ON DELETE CASCADE,
  "menuItemId" text NOT NULL REFERENCES "menuItem"("id") ON DELETE CASCADE,
  "variantId" text,
  "addonId" text,
  "ingredientId" text NOT NULL REFERENCES "inventoryItem"("id") ON DELETE RESTRICT,
  "quantity" double precision NOT NULL,
  "wastePercent" double precision DEFAULT 0,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "menuItemRecipe_menuItemId_idx" ON "menuItemRecipe"("menuItemId");
CREATE INDEX IF NOT EXISTS "menuItemRecipe_ingredientId_idx" ON "menuItemRecipe"("ingredientId");
CREATE INDEX IF NOT EXISTS "menuItemRecipe_restaurantId_idx" ON "menuItemRecipe"("restaurantId");

-- 4. Inventory Transaction Ledger
CREATE TABLE IF NOT EXISTS "inventoryTransaction" (
  "id" text PRIMARY KEY,
  "restaurantId" text NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "outletId" text NOT NULL REFERENCES "restaurantOutlet"("id") ON DELETE CASCADE,
  "ingredientId" text NOT NULL REFERENCES "inventoryItem"("id") ON DELETE CASCADE,
  "type" text NOT NULL, -- 'PURCHASE' | 'ORDER_CONSUMPTION' | 'ORDER_RESTORE' | 'WASTAGE' | 'ADJUSTMENT' | 'RETURN'
  "quantity" double precision NOT NULL,
  "balanceAfter" double precision NOT NULL,
  "unitCostPaise" integer DEFAULT 0,
  "referenceId" text,
  "referenceNote" text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "createdBy" text
);

CREATE INDEX IF NOT EXISTS "inventoryTx_ingredientId_idx" ON "inventoryTransaction"("ingredientId");
CREATE INDEX IF NOT EXISTS "inventoryTx_outletId_createdAt_idx" ON "inventoryTransaction"("outletId", "createdAt");
CREATE INDEX IF NOT EXISTS "inventoryTx_referenceId_idx" ON "inventoryTransaction"("referenceId");

-- 5. Purchase Orders (Stock In / GRN)
CREATE TABLE IF NOT EXISTS "purchaseOrder" (
  "id" text PRIMARY KEY,
  "restaurantId" text NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "outletId" text NOT NULL REFERENCES "restaurantOutlet"("id") ON DELETE CASCADE,
  "supplierId" text REFERENCES "inventorySupplier"("id") ON DELETE SET NULL,
  "poNumber" text NOT NULL,
  "invoiceNumber" text,
  "invoiceDate" text,
  "status" text NOT NULL DEFAULT 'RECEIVED',
  "totalAmountPaise" integer NOT NULL DEFAULT 0,
  "notes" text,
  "receivedAt" timestamp with time zone,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "createdBy" text
);

CREATE INDEX IF NOT EXISTS "purchaseOrder_outletId_idx" ON "purchaseOrder"("outletId");
CREATE INDEX IF NOT EXISTS "purchaseOrder_restaurantId_idx" ON "purchaseOrder"("restaurantId");

-- 6. Purchase Order Items
CREATE TABLE IF NOT EXISTS "purchaseOrderItem" (
  "id" text PRIMARY KEY,
  "purchaseOrderId" text NOT NULL REFERENCES "purchaseOrder"("id") ON DELETE CASCADE,
  "ingredientId" text NOT NULL REFERENCES "inventoryItem"("id") ON DELETE RESTRICT,
  "quantity" double precision NOT NULL,
  "unitCostPaise" integer NOT NULL,
  "totalPaise" integer NOT NULL,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "purchaseOrderItem_purchaseOrderId_idx" ON "purchaseOrderItem"("purchaseOrderId");
