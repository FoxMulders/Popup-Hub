-- Conversion Engine: external listing tier + ad click analytics

DO $$ BEGIN
  CREATE TYPE ad_campaign_status AS ENUM ('inactive', 'active', 'paused', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_external_listing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS destination_url TEXT,
  ADD COLUMN IF NOT EXISTS ad_campaign_status ad_campaign_status NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS ad_campaign_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN events.is_external_listing IS
  'External ad listing: coordinator sees premium UI teaser; ops locked until native migration.';
COMMENT ON COLUMN events.destination_url IS
  'Outbound URL for ad campaign track-click redirects when is_external_listing is true.';
COMMENT ON COLUMN events.ad_campaign_status IS
  'Lifecycle of the external ad campaign tied to this listing.';
COMMENT ON COLUMN events.ad_campaign_expires_at IS
  'When the external ad campaign expires; NULL means no expiry set.';

CREATE TABLE IF NOT EXISTS ad_clicks_log (
  id              BIGSERIAL PRIMARY KEY,
  market_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  clicked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address_hash VARCHAR(64) NOT NULL,
  user_agent      TEXT
);

CREATE INDEX IF NOT EXISTS ad_clicks_log_market_clicked_at_idx
  ON ad_clicks_log (market_id, clicked_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ad_clicks_log_market_ip_day_uidx
  ON ad_clicks_log (market_id, ip_address_hash, ((clicked_at AT TIME ZONE 'UTC')::date));

COMMENT ON TABLE ad_clicks_log IS
  'Analytics log for external listing ad click-through redirects.';

ALTER TABLE ad_clicks_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_clicks: service insert only" ON ad_clicks_log
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "ad_clicks: coordinator read own markets" ON ad_clicks_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = ad_clicks_log.market_id
        AND events.coordinator_id = auth.uid()
    )
  );

-- Block layout writes for external listings (defense in depth vs direct Supabase client)
DROP POLICY IF EXISTS "layouts: coordinator manage own" ON booth_layouts;
CREATE POLICY "layouts: coordinator read own" ON booth_layouts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = booth_layouts.event_id
        AND events.coordinator_id = auth.uid()
    )
  );
CREATE POLICY "layouts: coordinator write native" ON booth_layouts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = booth_layouts.event_id
        AND events.coordinator_id = auth.uid()
        AND events.is_external_listing = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = booth_layouts.event_id
        AND events.coordinator_id = auth.uid()
        AND events.is_external_listing = false
    )
  );

-- Block coordinator application mutations for external listings (reads stay open)
DROP POLICY IF EXISTS "applications: coordinator manage own event" ON booth_applications;
CREATE POLICY "applications: coordinator read own event" ON booth_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = booth_applications.event_id
        AND events.coordinator_id = auth.uid()
    )
  );
CREATE POLICY "applications: coordinator mutate native event" ON booth_applications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = booth_applications.event_id
        AND events.coordinator_id = auth.uid()
        AND events.is_external_listing = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = booth_applications.event_id
        AND events.coordinator_id = auth.uid()
        AND events.is_external_listing = false
    )
  );
