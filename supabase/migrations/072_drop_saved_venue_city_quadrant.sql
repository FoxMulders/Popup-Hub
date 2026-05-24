-- city_quadrant filter removed from wizard step 2; column no longer used.
ALTER TABLE coordinator_saved_venues DROP COLUMN IF EXISTS city_quadrant;
