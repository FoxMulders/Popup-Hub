-- Event accessibility & logistics fields for shoppers

DO $$ BEGIN
  CREATE TYPE pet_policy AS ENUM (
    'pet_friendly',
    'service_animals_only',
    'no_pets'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS parking_notes TEXT,
  ADD COLUMN IF NOT EXISTS wheelchair_access_notes TEXT,
  ADD COLUMN IF NOT EXISTS pet_policy pet_policy NOT NULL DEFAULT 'service_animals_only';

COMMENT ON COLUMN events.parking_notes IS 'Parking guidance for shoppers.';
COMMENT ON COLUMN events.wheelchair_access_notes IS 'Wheelchair / mobility access notes.';
COMMENT ON COLUMN events.pet_policy IS 'Pet policy for the venue.';
