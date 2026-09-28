-- Migration: 024_roles_and_permissions.sql
-- Adds restaurantRole table for custom roles and granular permission matrix

CREATE TABLE IF NOT EXISTS "restaurantRole" (
  "id" text PRIMARY KEY,
  "restaurantId" text NOT NULL REFERENCES "restaurant"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "isSystem" boolean NOT NULL DEFAULT false,
  "permissions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "allOutlets" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp with time zone NOT NULL DEFAULT now(),
  "updatedAt" timestamp with time zone NOT NULL DEFAULT now(),
  "createdBy" text,
  "updatedBy" text,
  CONSTRAINT "restaurantRole_restaurantId_name_uniq" UNIQUE ("restaurantId", "name")
);

CREATE INDEX IF NOT EXISTS "restaurantRole_restaurantId_idx" ON "restaurantRole"("restaurantId");
