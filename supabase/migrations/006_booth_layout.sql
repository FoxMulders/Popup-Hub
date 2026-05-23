CREATE TABLE IF NOT EXISTS booth_layouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  venue_width  INTEGER NOT NULL DEFAULT 100,
  venue_length INTEGER NOT NULL DEFAULT 100,
  booth_width  INTEGER NOT NULL DEFAULT 10,
  booth_length INTEGER NOT NULL DEFAULT 10,
  entrance     TEXT NOT NULL DEFAULT 'south',
  cells        JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE booth_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "layouts: coordinator manage own" ON booth_layouts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = booth_layouts.event_id AND events.coordinator_id = auth.uid())
  );

CREATE POLICY "layouts: public read published" ON booth_layouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = booth_layouts.event_id AND events.status IN ('published','active','completed'))
  );
