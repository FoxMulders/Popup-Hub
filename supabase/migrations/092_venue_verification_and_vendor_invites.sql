-- Venue verification on events + turnkey vendor priority invites / booth slot access phases.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS venue_verification_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS venue_verification_reason TEXT,
  ADD COLUMN IF NOT EXISTS venue_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_place_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vendor_access_equality_until TIMESTAMPTZ;

COMMENT ON COLUMN events.venue_verified IS 'True when map coordinates resolve to a valid commercial, park, or public venue.';
COMMENT ON COLUMN events.venue_verification_status IS 'pending | verified | rejected | manual_override';
COMMENT ON COLUMN events.vendor_access_equality_until IS 'Until this time, ranking-based priority is disabled for booth access on this event (set on first public release).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_venue_verification_status_check'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_venue_verification_status_check
      CHECK (venue_verification_status IN ('pending', 'verified', 'rejected', 'manual_override'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS event_booth_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  layout_object_id TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id),
  access_phase TEXT NOT NULL DEFAULT 'coordinator_only',
  priority_invite_batch_id UUID,
  priority_window_ends_at TIMESTAMPTZ,
  public_released_at TIMESTAMPTZ,
  claimed_by_application_id UUID REFERENCES booth_applications(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, layout_object_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_booth_slots_access_phase_check'
  ) THEN
    ALTER TABLE event_booth_slots
      ADD CONSTRAINT event_booth_slots_access_phase_check
      CHECK (access_phase IN ('coordinator_only', 'priority_exclusive', 'public_release'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_booth_slots_event_phase
  ON event_booth_slots(event_id, access_phase);

CREATE INDEX IF NOT EXISTS idx_event_booth_slots_category
  ON event_booth_slots(event_id, category_id);

CREATE TABLE IF NOT EXISTS vendor_priority_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booth_slot_id UUID NOT NULL REFERENCES event_booth_slots(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  UNIQUE (event_id, vendor_id, booth_slot_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_priority_invites_vendor
  ON vendor_priority_invites(vendor_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_priority_invites_event_batch
  ON vendor_priority_invites(event_id, batch_id);

ALTER TABLE event_booth_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_priority_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_booth_slots: coordinator manage own event" ON event_booth_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_booth_slots.event_id
        AND e.coordinator_id = auth.uid()
    )
  );

CREATE POLICY "event_booth_slots: vendor read published event" ON event_booth_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_booth_slots.event_id
        AND e.status IN ('published', 'active', 'completed')
    )
  );

CREATE POLICY "vendor_priority_invites: coordinator manage own event" ON vendor_priority_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = vendor_priority_invites.event_id
        AND e.coordinator_id = auth.uid()
    )
  );

CREATE POLICY "vendor_priority_invites: vendor read own" ON vendor_priority_invites
  FOR SELECT USING (auth.uid() = vendor_id);

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'priority_booth_invite';
