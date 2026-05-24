-- Idempotent repair for quarter-auction columns/tables blocked by duplicate migration versions.

ALTER TABLE quarter_auction_settings
  ADD COLUMN IF NOT EXISTS paddle_pool_size INTEGER NOT NULL DEFAULT 100;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quarter_auction_settings_paddle_pool_size_check'
  ) THEN
    ALTER TABLE quarter_auction_settings
      ADD CONSTRAINT quarter_auction_settings_paddle_pool_size_check
      CHECK (paddle_pool_size >= 1 AND paddle_pool_size <= 200);
  END IF;
END $$;

COMMENT ON COLUMN quarter_auction_settings.paddle_pool_size IS
  'Number of paddle numbers available (1..N). Max 200. White chips 1–100, green 101–200.';

ALTER TABLE quarter_auction_settings
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;

COMMENT ON COLUMN quarter_auction_settings.scheduled_start_at IS
  'Advertised quarter auction start; catalog items cannot activate or open bidding before this time.';

ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;

COMMENT ON COLUMN auctions.scheduled_start_at IS
  'Advertised start time; manual start is blocked until this moment.';

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS market_city text NOT NULL DEFAULT 'edmonton';

ALTER TABLE coordinator_saved_venues
  ADD COLUMN IF NOT EXISTS market_city text NOT NULL DEFAULT 'edmonton';

CREATE TABLE IF NOT EXISTS event_auction_participants (
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_in_lat      DOUBLE PRECISION NOT NULL,
  check_in_lng      DOUBLE PRECISION NOT NULL,
  distance_meters   DOUBLE PRECISION,
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_eap_event ON event_auction_participants(event_id, participated_at DESC);

ALTER TABLE event_auction_participants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "eap: user read own"
    ON event_auction_participants FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "eap: user insert own"
    ON event_auction_participants FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "eap: coordinator read event"
    ON event_auction_participants FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = event_auction_participants.event_id
          AND e.coordinator_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "ep: authenticated read numbers for pool"
    ON event_paddles FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
