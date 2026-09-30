-- Migration 027: Bulletproof Database Triggers for Platform Superadmin Isolation
-- Ensures NO transaction can ever link an ADMIN user or phone to outletStaff or restaurant.ownerUserId.

CREATE OR REPLACE FUNCTION check_outlet_staff_not_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Check if userId belongs to an ADMIN
  IF NEW."userId" IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM "user" WHERE id = NEW."userId" AND role = 'ADMIN') THEN
      RAISE EXCEPTION 'Cannot add platform superadmin (userId: %) to outletStaff. Admin must have only the ADMIN role.', NEW."userId";
    END IF;
  END IF;

  -- 2. Check if phone matches any ADMIN (normalized last 10 digits)
  IF EXISTS (
    SELECT 1 FROM "user" 
    WHERE role = 'ADMIN' 
      AND RIGHT(REGEXP_REPLACE("phoneNumber", '\D', '', 'g'), 10) = RIGHT(REGEXP_REPLACE(NEW.phone, '\D', '', 'g'), 10)
  ) THEN
    RAISE EXCEPTION 'Cannot add platform superadmin (phone: %) to outletStaff. Admin must have only the ADMIN role.', NEW.phone;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_outlet_staff_not_admin ON "outletStaff";
CREATE TRIGGER trg_check_outlet_staff_not_admin
BEFORE INSERT OR UPDATE ON "outletStaff"
FOR EACH ROW
EXECUTE FUNCTION check_outlet_staff_not_admin();

-- 3. Check if restaurant ownerUserId is set to an ADMIN
CREATE OR REPLACE FUNCTION check_restaurant_owner_not_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."ownerUserId" IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM "user" WHERE id = NEW."ownerUserId" AND role = 'ADMIN') THEN
      RAISE EXCEPTION 'Cannot set platform superadmin (userId: %) as restaurant owner. Admin ID must not be linked to any restaurant.', NEW."ownerUserId";
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_restaurant_owner_not_admin ON "restaurant";
CREATE TRIGGER trg_check_restaurant_owner_not_admin
BEFORE INSERT OR UPDATE ON "restaurant"
FOR EACH ROW
EXECUTE FUNCTION check_restaurant_owner_not_admin();
