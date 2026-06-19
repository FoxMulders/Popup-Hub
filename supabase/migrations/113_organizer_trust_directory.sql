-- Trust directory: organizers, events, community mentions, scam alerts (Edmonton launch wedge)

CREATE TABLE IF NOT EXISTS organizers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  primary_contact_name TEXT,
  city            TEXT NOT NULL,
  province        TEXT NOT NULL DEFAULT 'AB',
  region          TEXT NOT NULL DEFAULT 'edmonton-metro',
  website_url     TEXT,
  facebook_url    TEXT,
  instagram_handle TEXT,
  typical_season_or_dates TEXT,
  claimed_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at      TIMESTAMPTZ,
  popup_hub_coordinator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  listing_status  TEXT NOT NULL DEFAULT 'draft'
    CHECK (listing_status IN ('draft', 'published', 'archived')),
  source          TEXT NOT NULL DEFAULT 'seed'
    CHECK (source IN ('seed', 'fb_extract', 'popup_hub', 'vendor_submitted')),
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizers_region ON organizers (region);
CREATE INDEX IF NOT EXISTS idx_organizers_city ON organizers (city);
CREATE INDEX IF NOT EXISTS idx_organizers_listing_status ON organizers (listing_status);

CREATE TABLE IF NOT EXISTS organizer_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id    UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  city            TEXT,
  typical_dates   TEXT,
  booth_fee_cad   NUMERIC(10, 2),
  source_snippet  TEXT,
  listing_status  TEXT NOT NULL DEFAULT 'draft'
    CHECK (listing_status IN ('draft', 'published', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizer_events_organizer ON organizer_events (organizer_id);

CREATE TABLE IF NOT EXISTS scam_watchlist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  warning_title   TEXT NOT NULL,
  warning_body    TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'ai_extract_unverified'
    CHECK (verification_status IN (
      'ai_extract_unverified',
      'human_saw_in_group',
      'permalink_verified',
      'screenshot_verified',
      'official_site_corroborated',
      'admin_confirmed'
    )),
  source_permalink TEXT,
  source_snippet  TEXT,
  published       BOOLEAN NOT NULL DEFAULT FALSE,
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizer_scam_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id    UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  alert_title     TEXT NOT NULL,
  alert_body      TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'ai_extract_unverified'
    CHECK (verification_status IN (
      'ai_extract_unverified',
      'human_saw_in_group',
      'permalink_verified',
      'screenshot_verified',
      'official_site_corroborated',
      'admin_confirmed'
    )),
  source_permalink TEXT,
  source_snippet  TEXT,
  published       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizer_scam_alerts_organizer ON organizer_scam_alerts (organizer_id);

CREATE TABLE IF NOT EXISTS organizer_community_mentions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id    UUID REFERENCES organizers(id) ON DELETE CASCADE,
  coordinator_person_name TEXT,
  quote           TEXT NOT NULL,
  sentiment       TEXT
    CHECK (sentiment IS NULL OR sentiment IN ('positive', 'mixed', 'negative', 'neutral')),
  mention_type    TEXT NOT NULL DEFAULT 'other',
  verification_status TEXT NOT NULL DEFAULT 'ai_extract_unverified'
    CHECK (verification_status IN (
      'ai_extract_unverified',
      'human_saw_in_group',
      'permalink_verified',
      'screenshot_verified',
      'official_site_corroborated',
      'admin_confirmed'
    )),
  source_permalink TEXT,
  source_snippet  TEXT,
  published       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizer_mentions_organizer ON organizer_community_mentions (organizer_id);

ALTER TABLE organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scam_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_scam_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_community_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizers: public read published" ON organizers
  FOR SELECT USING (listing_status = 'published');

CREATE POLICY "organizer_events: public read published" ON organizer_events
  FOR SELECT USING (listing_status = 'published');

CREATE POLICY "scam_watchlist: public read published" ON scam_watchlist
  FOR SELECT USING (published = TRUE);

CREATE POLICY "organizer_scam_alerts: public read published" ON organizer_scam_alerts
  FOR SELECT USING (published = TRUE);

CREATE POLICY "organizer_mentions: public read published" ON organizer_community_mentions
  FOR SELECT USING (published = TRUE);

COMMENT ON TABLE organizers IS 'Trust directory organizers (on/off PopUp Hub). Draft until admin publishes.';
COMMENT ON TABLE organizer_scam_alerts IS 'Scam warnings linked to an organizer profile; require verification before publish.';
