-- Events that only need a map pin + vendor caps (no booth floor plan).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS skip_venue_layout BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.skip_venue_layout IS
  'When true, coordinators skip the booth layout editor; venue name and address still required for discovery.';
