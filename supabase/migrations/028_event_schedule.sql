-- Live event schedule items (stage, workshops)

CREATE TABLE IF NOT EXISTS event_schedule_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  location_label  TEXT,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ,
  description     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_schedule_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_schedule: public read published" ON event_schedule_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_schedule_items.event_id
        AND e.status IN ('published', 'active', 'completed')
    )
  );

CREATE POLICY "event_schedule: coordinator manage" ON event_schedule_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_schedule_items.event_id
        AND e.coordinator_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_event_schedule_event ON event_schedule_items(event_id, starts_at);
