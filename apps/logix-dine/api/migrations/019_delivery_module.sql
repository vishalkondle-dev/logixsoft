-- Migration: 019_delivery_module.sql
-- Complete delivery module: orderType, deliveryOrder, customerAddress, deliveryRider

-- 1. Add orderType and delivery fees to saleOrder
ALTER TABLE "saleOrder" 
  ADD COLUMN IF NOT EXISTS "orderType" text NOT NULL DEFAULT 'DINE_IN',
  ADD COLUMN IF NOT EXISTS "packagingChargePaise" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "deliveryChargePaise" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "saleOrder_outletId_orderType_idx" ON "saleOrder"("outletId", "orderType");

-- 2. Delivery Orders Table
CREATE TABLE IF NOT EXISTS "deliveryOrder" (
  "id" text PRIMARY KEY,
  "orderId" text NOT NULL REFERENCES "saleOrder"("id") ON DELETE CASCADE,
  "restaurantId" text NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "outletId" text NOT NULL REFERENCES "restaurantOutlet"("id") ON DELETE CASCADE,
  "customerName" text NOT NULL,
  "customerPhone" text NOT NULL,
  "alternatePhone" text,
  "addressLine1" text NOT NULL,
  "addressLine2" text,
  "landmark" text,
  "city" text NOT NULL DEFAULT '',
  "pincode" text NOT NULL DEFAULT '',
  "latitude" double precision,
  "longitude" double precision,
  "deliveryNotes" text,
  "deliveryMode" text NOT NULL DEFAULT 'IN_HOUSE',
  "deliveryProvider" text,
  "riderId" text,
  "riderName" text,
  "riderPhone" text,
  "riderVehicleNo" text,
  "deliveryOtp" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING_ASSIGNMENT',
  "estimatedMinutes" integer DEFAULT 35,
  "assignedAt" timestamp,
  "pickedUpAt" timestamp,
  "deliveredAt" timestamp,
  "failedReason" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "deliveryOrder_orderId_idx" ON "deliveryOrder"("orderId");
CREATE INDEX IF NOT EXISTS "deliveryOrder_outletId_status_idx" ON "deliveryOrder"("outletId", "status");
CREATE INDEX IF NOT EXISTS "deliveryOrder_customerPhone_idx" ON "deliveryOrder"("customerPhone");

-- 3. Customer Saved Addresses
CREATE TABLE IF NOT EXISTS "customerAddress" (
  "id" text PRIMARY KEY,
  "customerPhone" text NOT NULL,
  "label" text NOT NULL DEFAULT 'Home',
  "receiverName" text,
  "receiverPhone" text,
  "addressLine1" text NOT NULL,
  "addressLine2" text,
  "landmark" text,
  "city" text NOT NULL DEFAULT '',
  "pincode" text NOT NULL DEFAULT '',
  "latitude" double precision,
  "longitude" double precision,
  "isDefault" boolean DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "customerAddress_customerPhone_idx" ON "customerAddress"("customerPhone");

-- 4. Delivery Riders (In-house fleet)
CREATE TABLE IF NOT EXISTS "deliveryRider" (
  "id" text PRIMARY KEY,
  "restaurantId" text NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "outletId" text NOT NULL REFERENCES "restaurantOutlet"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "phone" text NOT NULL,
  "vehicleType" text NOT NULL DEFAULT 'BIKE',
  "vehicleNumber" text,
  "status" text NOT NULL DEFAULT 'AVAILABLE',
  "currentLatitude" double precision,
  "currentLongitude" double precision,
  "lastLocationAt" timestamp,
  "activeOrderId" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "deliveryRider_outletId_status_idx" ON "deliveryRider"("outletId", "status");
