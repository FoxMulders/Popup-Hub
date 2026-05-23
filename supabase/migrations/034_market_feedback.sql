-- User feedback & error reporting for markets (events)

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'feedback_addressed';

CREATE TABLE IF NOT EXISTS market_feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  market_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  comment_text  TEXT NOT NULL CHECK (char_length(trim(comment_text)) > 0),
  is_addressed  BOOLEAN NOT NULL DEFAULT FALSE,
  context_type  TEXT,
  context_id    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE market_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_feedback: user insert own" ON market_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "market_feedback: user read own" ON market_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "market_feedback: coordinator read own markets" ON market_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = market_feedback.market_id
        AND e.coordinator_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'coordinator'
    )
  );

CREATE POLICY "market_feedback: coordinator update own markets" ON market_feedback
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = market_feedback.market_id
        AND e.coordinator_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'coordinator'
    )
  );

CREATE INDEX IF NOT EXISTS idx_market_feedback_market_unaddressed
  ON market_feedback (market_id, created_at DESC)
  WHERE is_addressed = FALSE;

CREATE INDEX IF NOT EXISTS idx_market_feedback_user
  ON market_feedback (user_id, created_at DESC);
