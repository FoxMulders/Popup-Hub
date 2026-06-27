-- HubGuard organizer claims require platform admin approval before claimed_by is set.

CREATE TABLE IF NOT EXISTS organizer_claim_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id    UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  requested_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  verification_note TEXT,
  reviewed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizer_claim_requests_pending_unique
  ON organizer_claim_requests (organizer_id, requested_by)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_organizer_claim_requests_status
  ON organizer_claim_requests (status, created_at DESC);

ALTER TABLE organizer_claim_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizer_claim_requests: requester read own"
  ON organizer_claim_requests FOR SELECT
  USING (auth.uid() = requested_by);

CREATE POLICY "organizer_claim_requests: admin read all"
  ON organizer_claim_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

CREATE POLICY "organizer_claim_requests: coordinator insert own pending"
  ON organizer_claim_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requested_by
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'coordinator' OR p.is_admin = true)
    )
  );

COMMENT ON TABLE organizer_claim_requests IS 'Pending HubGuard organizer profile claims — admin approves before organizers.claimed_by is set.';
