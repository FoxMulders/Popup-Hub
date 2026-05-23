-- Vendor follows (post-event engagement)

CREATE TABLE IF NOT EXISTS vendor_follows (
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vendor_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, vendor_id)
);

ALTER TABLE vendor_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_follows: owner all" ON vendor_follows
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_follows_user ON vendor_follows(user_id);
