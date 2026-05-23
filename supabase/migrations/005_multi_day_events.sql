-- ============================================================
-- Migration 005: Multi-day events support
-- ============================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS is_multi_day BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS event_days (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (event_id, date)
);

ALTER TABLE event_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_days: public read" ON event_days
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_days.event_id AND events.status IN ('published','active','completed'))
  );

CREATE POLICY "event_days: coordinator manage own" ON event_days
  FOR ALL USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_days.event_id AND events.coordinator_id = auth.uid())
  );
