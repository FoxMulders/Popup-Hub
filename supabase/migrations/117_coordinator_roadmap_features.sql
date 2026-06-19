-- Coordinator roadmap: league vendor discount, venue admin review, Google Docs tokens.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS community_league_discount_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS community_league_discount_percent INTEGER NOT NULL DEFAULT 0
    CHECK (community_league_discount_percent >= 0 AND community_league_discount_percent <= 100);

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS community_league_member_claim BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS platform_venue_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_name   TEXT NOT NULL,
  address         TEXT NOT NULL,
  latitude        DOUBLE PRECISION NOT NULL,
  longitude       DOUBLE PRECISION NOT NULL,
  market_city     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note      TEXT,
  reviewed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_venue_submissions_coords_check CHECK (
    latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_venue_submissions_active_unique_idx
  ON platform_venue_submissions (lower(trim(location_name)), lower(trim(address)))
  WHERE status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS platform_venue_submissions_status_idx
  ON platform_venue_submissions (status, created_at DESC);

ALTER TABLE platform_venue_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_submissions: coordinator insert own" ON platform_venue_submissions
  FOR INSERT
  WITH CHECK (
    auth.uid() = submitted_by
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator'
    )
  );

CREATE POLICY "venue_submissions: coordinator read own" ON platform_venue_submissions
  FOR SELECT
  USING (
    auth.uid() = submitted_by
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'coordinator')
    )
  );

CREATE POLICY "venue_submissions: admin update" ON platform_venue_submissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS google_access_token TEXT,
  ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION set_platform_venue_submissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS platform_venue_submissions_updated_at ON platform_venue_submissions;

CREATE TRIGGER platform_venue_submissions_updated_at
  BEFORE UPDATE ON platform_venue_submissions
  FOR EACH ROW
  EXECUTE FUNCTION set_platform_venue_submissions_updated_at();
