-- Shopper favorites (saved markets)

CREATE TABLE IF NOT EXISTS shopper_favorites (
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

ALTER TABLE shopper_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopper_favorites: owner all" ON shopper_favorites
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_shopper_favorites_user ON shopper_favorites(user_id);
