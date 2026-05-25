-- Paddle & Passport gamification for checked-in market patrons.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS passport_vendors_required INTEGER;

COMMENT ON COLUMN events.passport_vendors_required IS
  'Number of vendor passport scans required for the patron bonus. NULL uses default (5).';

CREATE TABLE IF NOT EXISTS market_patron_check_ins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  paddle_number   INTEGER NOT NULL CHECK (paddle_number >= 1),
  checked_in_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_in_lat    DOUBLE PRECISION,
  check_in_lng    DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,
  UNIQUE (event_id, user_id),
  UNIQUE (event_id, paddle_number)
);

CREATE INDEX IF NOT EXISTS idx_mpci_event ON market_patron_check_ins(event_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_mpci_user ON market_patron_check_ins(user_id, checked_in_at DESC);

CREATE TABLE IF NOT EXISTS passport_scans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vendor_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scanned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_passport_scans_event_user
  ON passport_scans(event_id, user_id, scanned_at DESC);

ALTER TABLE market_patron_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE passport_scans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "mpci: user read own"
    ON market_patron_check_ins FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "mpci: user insert own"
    ON market_patron_check_ins FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "mpci: coordinator read event"
    ON market_patron_check_ins FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = market_patron_check_ins.event_id
          AND e.coordinator_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "passport_scans: user read own"
    ON passport_scans FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "passport_scans: user insert own"
    ON passport_scans FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "passport_scans: coordinator read event"
    ON passport_scans FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = passport_scans.event_id
          AND e.coordinator_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
