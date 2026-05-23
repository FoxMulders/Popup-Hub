-- Booth clearance policy per event (coordinator chooses at setup / operations)

DO $$ BEGIN
  CREATE TYPE booth_clearance_policy AS ENUM (
    'not_required',
    'leave_furniture',
    'pack_furniture'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS booth_clearance_policy booth_clearance_policy NOT NULL DEFAULT 'leave_furniture';
