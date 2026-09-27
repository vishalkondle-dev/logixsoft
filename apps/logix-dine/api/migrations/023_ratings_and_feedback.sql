-- Migration: 023_ratings_and_feedback.sql
-- Adds ratingAvg and ratingCount columns to menuItem
-- Adds orderFeedback and orderItemFeedback tables for end-to-end customer ratings & reviews

ALTER TABLE "menuItem" ADD COLUMN IF NOT EXISTS "ratingAvg" double precision DEFAULT 0;
ALTER TABLE "menuItem" ADD COLUMN IF NOT EXISTS "ratingCount" integer DEFAULT 0;

-- 1. Order Feedback / Overall Review
CREATE TABLE IF NOT EXISTS "orderFeedback" (
  "id" text PRIMARY KEY,
  "restaurantId" text NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "outletId" text NOT NULL REFERENCES "restaurantOutlet"("id") ON DELETE CASCADE,
  "orderId" text NOT NULL REFERENCES "saleOrder"("id") ON DELETE CASCADE,
  "customerPhone" text NOT NULL,
  "customerName" text,
  "isAnonymous" boolean NOT NULL DEFAULT false,
  "rating" integer NOT NULL,
  "foodRating" integer,
  "serviceRating" integer,
  "deliveryRating" integer,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "comment" text,
  "ownerReply" text,
  "ownerRepliedAt" timestamp with time zone,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "orderFeedback_orderId_unique" UNIQUE ("orderId")
);

CREATE INDEX IF NOT EXISTS "orderFeedback_restaurantId_idx" ON "orderFeedback"("restaurantId");
CREATE INDEX IF NOT EXISTS "orderFeedback_outletId_idx" ON "orderFeedback"("outletId");
CREATE INDEX IF NOT EXISTS "orderFeedback_customerPhone_idx" ON "orderFeedback"("customerPhone");
CREATE INDEX IF NOT EXISTS "orderFeedback_rating_idx" ON "orderFeedback"("rating");
CREATE INDEX IF NOT EXISTS "orderFeedback_createdAt_idx" ON "orderFeedback"("createdAt");

-- 2. Item-Specific Feedback / Dish Reviews
CREATE TABLE IF NOT EXISTS "orderItemFeedback" (
  "id" text PRIMARY KEY,
  "reviewId" text NOT NULL REFERENCES "orderFeedback"("id") ON DELETE CASCADE,
  "orderId" text NOT NULL,
  "menuItemId" text NOT NULL REFERENCES "menuItem"("id") ON DELETE CASCADE,
  "rating" integer NOT NULL,
  "comment" text,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "orderItemFeedback_reviewId_idx" ON "orderItemFeedback"("reviewId");
CREATE INDEX IF NOT EXISTS "orderItemFeedback_orderId_idx" ON "orderItemFeedback"("orderId");
CREATE INDEX IF NOT EXISTS "orderItemFeedback_menuItemId_idx" ON "orderItemFeedback"("menuItemId");
