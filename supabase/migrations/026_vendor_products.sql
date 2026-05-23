-- Vendor product catalogues (V2)

CREATE TABLE IF NOT EXISTS vendor_products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  image_urls        TEXT[] NOT NULL DEFAULT '{}',
  price_min_cents   INTEGER CHECK (price_min_cents IS NULL OR price_min_cents >= 0),
  price_max_cents   INTEGER CHECK (price_max_cents IS NULL OR price_max_cents >= 0),
  is_featured       BOOLEAN NOT NULL DEFAULT FALSE,
  sold_out          BOOLEAN NOT NULL DEFAULT FALSE,
  flash_sale_until  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vendor_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_products: public read featured" ON vendor_products
  FOR SELECT USING (is_featured = TRUE OR auth.uid() = vendor_id);

CREATE POLICY "vendor_products: vendor manage own" ON vendor_products
  FOR ALL USING (auth.uid() = vendor_id);

CREATE TABLE IF NOT EXISTS market_preorders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shopper_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES vendor_products(id) ON DELETE SET NULL,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'picked_up', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE market_preorders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_preorders: shopper own" ON market_preorders
  FOR ALL USING (auth.uid() = shopper_id);

CREATE POLICY "market_preorders: vendor read own event" ON market_preorders
  FOR SELECT USING (auth.uid() = vendor_id);

CREATE INDEX IF NOT EXISTS idx_vendor_products_vendor ON vendor_products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_market_preorders_event ON market_preorders(event_id);
