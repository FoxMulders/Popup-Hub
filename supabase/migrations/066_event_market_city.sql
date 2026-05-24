-- Persist wizard city selection on events and saved venues.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS market_city text NOT NULL DEFAULT 'edmonton';

ALTER TABLE coordinator_saved_venues
  ADD COLUMN IF NOT EXISTS market_city text NOT NULL DEFAULT 'edmonton';

COMMENT ON COLUMN events.market_city IS 'Market city id from lib/wizard/market-cities (e.g. edmonton, calgary).';
COMMENT ON COLUMN coordinator_saved_venues.market_city IS 'City id when venue was saved for reuse.';
