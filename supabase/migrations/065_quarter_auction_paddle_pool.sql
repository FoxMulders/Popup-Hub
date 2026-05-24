-- Patron-selected paddle numbers with pool up to 200 (white 1–100, green 101–200).
ALTER TABLE quarter_auction_settings
  ADD COLUMN IF NOT EXISTS paddle_pool_size INTEGER NOT NULL DEFAULT 100
    CHECK (paddle_pool_size >= 1 AND paddle_pool_size <= 200);

COMMENT ON COLUMN quarter_auction_settings.default_entry_credits IS
  'Default bid entry cost for new catalog items (credits per paddle per item). Each item may override.';

COMMENT ON COLUMN quarter_auction_settings.paddle_pool_size IS
  'Number of paddle numbers available (1..N). Max 200. White chips 1–100, green 101–200.';

-- Authenticated users may read paddle numbers for availability (not owner-only).
CREATE POLICY "ep: authenticated read numbers for pool"
  ON event_paddles FOR SELECT
  TO authenticated
  USING (true);
