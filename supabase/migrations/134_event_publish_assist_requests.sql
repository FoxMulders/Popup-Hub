-- Coordinators blocked from publishing can request platform admin help.

CREATE TABLE IF NOT EXISTS event_publish_assist_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  coordinator_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  request_note    TEXT,
  block_reason    TEXT,
  review_note     TEXT,
  reviewed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_publish_assist_pending_unique
  ON event_publish_assist_requests (event_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_event_publish_assist_status
  ON event_publish_assist_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_publish_assist_coordinator
  ON event_publish_assist_requests (coordinator_id, created_at DESC);

ALTER TABLE event_publish_assist_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_publish_assist: coordinator read own" ON event_publish_assist_requests;
CREATE POLICY "event_publish_assist: coordinator read own"
  ON event_publish_assist_requests FOR SELECT
  USING (auth.uid() = coordinator_id);

DROP POLICY IF EXISTS "event_publish_assist: admin read all" ON event_publish_assist_requests;
CREATE POLICY "event_publish_assist: admin read all"
  ON event_publish_assist_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

DROP POLICY IF EXISTS "event_publish_assist: coordinator insert own pending" ON event_publish_assist_requests;
CREATE POLICY "event_publish_assist: coordinator insert own pending"
  ON event_publish_assist_requests FOR INSERT
  WITH CHECK (
    auth.uid() = coordinator_id
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id
        AND e.coordinator_id = auth.uid()
        AND e.status = 'draft'
    )
  );

DROP POLICY IF EXISTS "event_publish_assist: coordinator cancel own pending" ON event_publish_assist_requests;
CREATE POLICY "event_publish_assist: coordinator cancel own pending"
  ON event_publish_assist_requests FOR UPDATE
  USING (auth.uid() = coordinator_id AND status = 'pending')
  WITH CHECK (auth.uid() = coordinator_id AND status IN ('pending', 'cancelled'));

COMMENT ON TABLE event_publish_assist_requests IS
  'Coordinator requests for platform admin to publish a draft market on their behalf.';
