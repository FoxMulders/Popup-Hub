-- Vendor nearby-market alerts + native push device tokens

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'nearby_market_published';

CREATE TABLE IF NOT EXISTS vendor_market_alert_prefs (
  user_id         UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  home_lat        DOUBLE PRECISION NOT NULL,
  home_lng        DOUBLE PRECISION NOT NULL,
  radius_km       INT NOT NULL DEFAULT 50 CHECK (radius_km > 0 AND radius_km <= 500),
  category_ids    UUID[] NULL,
  notify_push     BOOLEAN NOT NULL DEFAULT TRUE,
  notify_email    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_in_app   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vendor_market_alert_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_market_alert_prefs: owner all" ON vendor_market_alert_prefs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_market_alert_prefs_user
  ON vendor_market_alert_prefs(user_id);

CREATE TABLE IF NOT EXISTS device_push_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token           TEXT NOT NULL,
  platform        TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

ALTER TABLE device_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_push_tokens: owner all" ON device_push_tokens
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user
  ON device_push_tokens(user_id);
