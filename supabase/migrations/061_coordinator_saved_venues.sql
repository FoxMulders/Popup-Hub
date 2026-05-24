-- Coordinator-saved venue locations for reuse in the market setup wizard.
CREATE TABLE IF NOT EXISTS coordinator_saved_venues (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_name     TEXT NOT NULL,
  address           TEXT NOT NULL,
  latitude          DOUBLE PRECISION NOT NULL,
  longitude         DOUBLE PRECISION NOT NULL,
  venue_preset_id   TEXT,
  skip_venue_layout BOOLEAN NOT NULL DEFAULT false,
  city_quadrant     TEXT,
  last_used_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coordinator_saved_venues_coords_check CHECK (
    latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
  ),
  CONSTRAINT coordinator_saved_venues_unique_location UNIQUE (coordinator_id, location_name, address)
);

CREATE INDEX IF NOT EXISTS coordinator_saved_venues_coordinator_idx
  ON coordinator_saved_venues (coordinator_id, last_used_at DESC);

ALTER TABLE coordinator_saved_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_venues: coordinator own" ON coordinator_saved_venues
  FOR ALL
  USING (
    auth.uid() = coordinator_id
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator'
    )
  )
  WITH CHECK (
    auth.uid() = coordinator_id
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator'
    )
  );

CREATE OR REPLACE FUNCTION set_coordinator_saved_venues_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coordinator_saved_venues_updated_at ON coordinator_saved_venues;

CREATE TRIGGER coordinator_saved_venues_updated_at
  BEFORE UPDATE ON coordinator_saved_venues
  FOR EACH ROW
  EXECUTE FUNCTION set_coordinator_saved_venues_updated_at();
