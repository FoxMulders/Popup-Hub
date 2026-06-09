-- Site-wide feature requests from coordinators, vendors, and patrons

CREATE TABLE IF NOT EXISTS feature_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_role     TEXT NOT NULL CHECK (session_role IN ('coordinator', 'vendor', 'patron')),
  submitter_role   TEXT NOT NULL CHECK (submitter_role IN ('coordinator', 'vendor', 'patron')),
  title            TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  target_component TEXT NOT NULL CHECK (char_length(trim(target_component)) > 0),
  problem          TEXT NOT NULL CHECK (char_length(trim(problem)) > 0),
  dream_solution   TEXT,
  impact_level     TEXT NOT NULL CHECK (impact_level IN ('nice_to_have', 'workflow_blocked', 'critical')),
  screenshot_url   TEXT,
  page_path        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_requests: user insert own" ON feature_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "feature_requests: user read own" ON feature_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_feature_requests_user_created
  ON feature_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feature_requests_impact_created
  ON feature_requests (impact_level, created_at DESC);
