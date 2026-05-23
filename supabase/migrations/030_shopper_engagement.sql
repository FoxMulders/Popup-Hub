-- Shopper purchases & reviews (V2/V3)

CREATE TABLE IF NOT EXISTS shopper_purchases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopper_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vendor_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id          UUID REFERENCES events(id) ON DELETE SET NULL,
  amount_cents      INTEGER NOT NULL CHECK (amount_cents >= 0),
  description       TEXT,
  square_payment_id TEXT,
  purchased_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE shopper_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopper_purchases: shopper read own" ON shopper_purchases
  FOR SELECT USING (auth.uid() = shopper_id);

CREATE POLICY "shopper_purchases: shopper insert own" ON shopper_purchases
  FOR INSERT WITH CHECK (auth.uid() = shopper_id);

CREATE TABLE IF NOT EXISTS event_reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_reviews: public read" ON event_reviews
  FOR SELECT USING (TRUE);

CREATE POLICY "event_reviews: author insert" ON event_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "event_reviews: author update own" ON event_reviews
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS vendor_reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id   UUID REFERENCES events(id) ON DELETE SET NULL,
  rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vendor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_reviews: public read" ON vendor_reviews
  FOR SELECT USING (TRUE);

CREATE POLICY "vendor_reviews: author insert" ON vendor_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_shopper_purchases_shopper ON shopper_purchases(shopper_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_reviews_event ON event_reviews(event_id);
