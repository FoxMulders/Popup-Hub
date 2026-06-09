-- Platform admin flag and feature-request triage fields

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.is_admin IS
  'Platform operator — grants access to /admin routes and feature-request management.';

ALTER TABLE feature_requests
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'planned', 'completed', 'declined')),
  ADD COLUMN IF NOT EXISTS developer_notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_feature_requests_status_created
  ON feature_requests (status, created_at DESC);

CREATE POLICY "feature_requests: admin read all" ON feature_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "feature_requests: admin update" ON feature_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );
