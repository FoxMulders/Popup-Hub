-- Distinguish community markets from garage and yard sales on discovery

DO $$ BEGIN
  CREATE TYPE event_listing_type AS ENUM ('community_market', 'garage_yard_sale');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS listing_type event_listing_type NOT NULL DEFAULT 'community_market';

CREATE INDEX IF NOT EXISTS idx_events_listing_type_status
  ON events (listing_type, status, start_at);
