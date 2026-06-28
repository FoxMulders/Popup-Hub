-- Coordinator operational data surfaced on native widgets (Phase 5 backfill).

CREATE TABLE IF NOT EXISTS coordinator_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  coordinator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE coordinator_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coordinator_incidents: coordinator manage" ON coordinator_incidents;
CREATE POLICY "coordinator_incidents: coordinator manage" ON coordinator_incidents
  FOR ALL
  USING (auth.uid() = coordinator_id)
  WITH CHECK (auth.uid() = coordinator_id);

CREATE INDEX IF NOT EXISTS idx_coordinator_incidents_event
  ON coordinator_incidents(event_id, status);

CREATE TABLE IF NOT EXISTS coordinator_vendor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coordinator_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coordinator_vendor_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coordinator_vendor_messages: vendor insert" ON coordinator_vendor_messages;
CREATE POLICY "coordinator_vendor_messages: vendor insert" ON coordinator_vendor_messages
  FOR INSERT
  WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "coordinator_vendor_messages: event participants read" ON coordinator_vendor_messages;
CREATE POLICY "coordinator_vendor_messages: event participants read" ON coordinator_vendor_messages
  FOR SELECT
  USING (
    auth.uid() = vendor_id
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id AND e.coordinator_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_coordinator_vendor_messages_event
  ON coordinator_vendor_messages(event_id, created_at DESC);

-- Patron widget filter preference (farmers vs artisan fairs).
CREATE TABLE IF NOT EXISTS widget_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  market_filter text NOT NULL DEFAULT 'all' CHECK (market_filter IN ('all', 'farmers', 'artisan')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE widget_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "widget_preferences: owner all" ON widget_preferences;
CREATE POLICY "widget_preferences: owner all" ON widget_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Daily vendor interest snapshot (follows + passport views).
CREATE TABLE IF NOT EXISTS vendor_interest_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT (CURRENT_DATE),
  follow_count integer NOT NULL DEFAULT 0,
  view_count integer NOT NULL DEFAULT 0,
  UNIQUE (vendor_id, day)
);

ALTER TABLE vendor_interest_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_interest_daily: vendor read" ON vendor_interest_daily;
CREATE POLICY "vendor_interest_daily: vendor read" ON vendor_interest_daily
  FOR SELECT
  USING (auth.uid() = vendor_id);

CREATE INDEX IF NOT EXISTS idx_vendor_interest_daily_vendor_day
  ON vendor_interest_daily(vendor_id, day DESC);

-- Coordinator broadcast audit log (widget quick-action).
CREATE TABLE IF NOT EXISTS coordinator_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  coordinator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coordinator_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coordinator_broadcasts: coordinator manage" ON coordinator_broadcasts;
CREATE POLICY "coordinator_broadcasts: coordinator manage" ON coordinator_broadcasts
  FOR ALL
  USING (auth.uid() = coordinator_id)
  WITH CHECK (auth.uid() = coordinator_id);

CREATE INDEX IF NOT EXISTS idx_coordinator_broadcasts_event
  ON coordinator_broadcasts(event_id, created_at DESC);
