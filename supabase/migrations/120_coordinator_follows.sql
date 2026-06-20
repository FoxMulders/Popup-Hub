-- Patrons follow market organizers for new-market notifications

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'coordinator_market_published';

CREATE TABLE IF NOT EXISTS coordinator_follows (
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coordinator_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, coordinator_id),
  CHECK (user_id <> coordinator_id)
);

ALTER TABLE coordinator_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coordinator_follows: owner all" ON coordinator_follows
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coordinator_follows_user ON coordinator_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_coordinator_follows_coordinator ON coordinator_follows(coordinator_id);

COMMENT ON TABLE coordinator_follows IS 'Patron follows an organizer profile to get notified when they publish new markets.';
