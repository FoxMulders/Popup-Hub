-- Coordinator-saved floor plan layouts for reuse at the same venue.
CREATE TABLE IF NOT EXISTS coordinator_saved_layouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  location_name   TEXT NOT NULL,
  address         TEXT NOT NULL,
  layout_rooms    JSONB NOT NULL DEFAULT '[]',
  active_room_id  TEXT,
  is_public       BOOLEAN NOT NULL DEFAULT false,
  last_used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coordinator_saved_layouts_unique_name
    UNIQUE (coordinator_id, location_name, address, name)
);

CREATE INDEX IF NOT EXISTS coordinator_saved_layouts_coordinator_idx
  ON coordinator_saved_layouts (coordinator_id, location_name, address, last_used_at DESC);

CREATE INDEX IF NOT EXISTS coordinator_saved_layouts_public_venue_idx
  ON coordinator_saved_layouts (location_name, address, is_public, last_used_at DESC)
  WHERE is_public = true;

ALTER TABLE coordinator_saved_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_layouts: coordinator own" ON coordinator_saved_layouts
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

CREATE POLICY "saved_layouts: coordinator read public at venue" ON coordinator_saved_layouts
  FOR SELECT
  USING (
    is_public = true
    AND coordinator_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator'
    )
  );

CREATE OR REPLACE FUNCTION set_coordinator_saved_layouts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS coordinator_saved_layouts_updated_at ON coordinator_saved_layouts;

CREATE TRIGGER coordinator_saved_layouts_updated_at
  BEFORE UPDATE ON coordinator_saved_layouts
  FOR EACH ROW
  EXECUTE FUNCTION set_coordinator_saved_layouts_updated_at();
