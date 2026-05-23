-- Per-coordinator vendor access gating

DO $$ BEGIN
  CREATE TYPE vendor_access_request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'vendor_access_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'vendor_access_rejected';

CREATE TABLE IF NOT EXISTS vendor_access_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopper_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coordinator_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message          TEXT,
  status           vendor_access_request_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS vendor_access_requests_one_pending
  ON vendor_access_requests (shopper_id, coordinator_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS coordinator_vendor_approvals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vendor_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_id     UUID REFERENCES vendor_access_requests(id) ON DELETE SET NULL,
  approved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (coordinator_id, vendor_user_id)
);

CREATE TABLE IF NOT EXISTS vendor_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID NOT NULL REFERENCES vendor_access_requests(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vendor_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordinator_vendor_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_access_requests: shopper read own" ON vendor_access_requests
  FOR SELECT USING (auth.uid() = shopper_id);

CREATE POLICY "vendor_access_requests: coordinator read own" ON vendor_access_requests
  FOR SELECT USING (auth.uid() = coordinator_id);

CREATE POLICY "vendor_access_requests: shopper insert" ON vendor_access_requests
  FOR INSERT WITH CHECK (auth.uid() = shopper_id);

CREATE POLICY "vendor_access_requests: coordinator update" ON vendor_access_requests
  FOR UPDATE USING (auth.uid() = coordinator_id);

CREATE POLICY "coordinator_vendor_approvals: vendor read own" ON coordinator_vendor_approvals
  FOR SELECT USING (auth.uid() = vendor_user_id);

CREATE POLICY "coordinator_vendor_approvals: coordinator read own" ON coordinator_vendor_approvals
  FOR SELECT USING (auth.uid() = coordinator_id);

CREATE POLICY "coordinator_vendor_approvals: coordinator insert" ON coordinator_vendor_approvals
  FOR INSERT WITH CHECK (auth.uid() = coordinator_id);

CREATE POLICY "vendor_invitations: token read for accept" ON vendor_invitations
  FOR SELECT USING (TRUE);

CREATE INDEX IF NOT EXISTS idx_vendor_access_requests_coordinator
  ON vendor_access_requests(coordinator_id, status, created_at DESC);

CREATE POLICY "vendor_invitations: coordinator insert" ON vendor_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendor_access_requests r
      WHERE r.id = vendor_invitations.request_id
        AND r.coordinator_id = auth.uid()
    )
  );

CREATE POLICY "vendor_invitations: shopper accept own" ON vendor_invitations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM vendor_access_requests r
      WHERE r.id = vendor_invitations.request_id
        AND r.shopper_id = auth.uid()
    )
  );
