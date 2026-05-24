-- Quarter Auction charity event: catalog items, multi-paddle bids, strict draw pool

DO $$ BEGIN
  CREATE TYPE auction_item_status AS ENUM (
    'draft',
    'queued',
    'active_price_setting',
    'bidding_open',
    'bidding_closed',
    'drawing',
    'completed',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'paddle_purchase';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'bid_entry';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS share_contact_with_vendors BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.share_contact_with_vendors IS
  'When true, auction winners may share phone/email with the donating vendor.';

-- Per-event quarter auction configuration
CREATE TABLE IF NOT EXISTS quarter_auction_settings (
  event_id                UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  enabled                 BOOLEAN NOT NULL DEFAULT true,
  paddle_purchase_credits INTEGER NOT NULL DEFAULT 4 CHECK (paddle_purchase_credits > 0),
  default_entry_credits   INTEGER NOT NULL DEFAULT 1 CHECK (default_entry_credits > 0),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE quarter_auction_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qas: public read when event published"
  ON quarter_auction_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = quarter_auction_settings.event_id
        AND e.status IN ('published', 'active', 'completed')
    )
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = quarter_auction_settings.event_id
        AND e.coordinator_id = auth.uid()
    )
  );

CREATE POLICY "qas: coordinator manage"
  ON quarter_auction_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = quarter_auction_settings.event_id
        AND e.coordinator_id = auth.uid()
    )
  );

-- Vendor approval for quarter auction participation
CREATE TABLE IF NOT EXISTS quarter_auction_vendor_approvals (
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  approved_by UUID NOT NULL REFERENCES profiles(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, vendor_id)
);

ALTER TABLE quarter_auction_vendor_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qava: coordinator manage"
  ON quarter_auction_vendor_approvals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = quarter_auction_vendor_approvals.event_id
        AND e.coordinator_id = auth.uid()
    )
  );

CREATE POLICY "qava: vendor read own"
  ON quarter_auction_vendor_approvals FOR SELECT
  USING (auth.uid() = vendor_id);

CREATE POLICY "qava: public read"
  ON quarter_auction_vendor_approvals FOR SELECT
  USING (true);

-- Vendor-submitted catalog items with state machine
CREATE TABLE IF NOT EXISTS auction_catalog_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  image_url           TEXT,
  retail_value_cents  INTEGER CHECK (retail_value_cents IS NULL OR retail_value_cents >= 0),
  queue_position      INTEGER NOT NULL DEFAULT 0,
  status              auction_item_status NOT NULL DEFAULT 'draft',
  entry_cost_credits  INTEGER CHECK (entry_cost_credits IS NULL OR entry_cost_credits > 0),
  pool_credits        INTEGER NOT NULL DEFAULT 0 CHECK (pool_credits >= 0),
  winning_paddle_number TEXT,
  winner_user_id      UUID REFERENCES profiles(id),
  approved_at         TIMESTAMPTZ,
  bidding_opened_at   TIMESTAMPTZ,
  bidding_closed_at   TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aci_event_queue ON auction_catalog_items(event_id, queue_position);
CREATE INDEX IF NOT EXISTS idx_aci_event_status ON auction_catalog_items(event_id, status);
CREATE INDEX IF NOT EXISTS idx_aci_vendor ON auction_catalog_items(vendor_id);

ALTER TABLE auction_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aci: public read non-draft"
  ON auction_catalog_items FOR SELECT
  USING (
    status <> 'draft'
    OR auth.uid() = vendor_id
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = auction_catalog_items.event_id
        AND e.coordinator_id = auth.uid()
    )
  );

CREATE POLICY "aci: vendor insert draft"
  ON auction_catalog_items FOR INSERT
  WITH CHECK (
    auth.uid() = vendor_id
    AND status = 'draft'
    AND EXISTS (
      SELECT 1 FROM quarter_auction_vendor_approvals q
      WHERE q.event_id = auction_catalog_items.event_id
        AND q.vendor_id = auth.uid()
    )
  );

CREATE POLICY "aci: vendor update own draft"
  ON auction_catalog_items FOR UPDATE
  USING (auth.uid() = vendor_id AND status = 'draft');

CREATE POLICY "aci: coordinator full manage"
  ON auction_catalog_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = auction_catalog_items.event_id
        AND e.coordinator_id = auth.uid()
    )
  );

-- Patron-owned virtual paddles (pre-purchased, non-refundable)
CREATE TABLE IF NOT EXISTS event_paddles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  paddle_number   TEXT NOT NULL,
  purchase_credits INTEGER NOT NULL CHECK (purchase_credits > 0),
  purchased_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, paddle_number)
);

CREATE INDEX IF NOT EXISTS idx_event_paddles_user ON event_paddles(event_id, user_id);

ALTER TABLE event_paddles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ep: owner read"
  ON event_paddles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "ep: coordinator read event"
  ON event_paddles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_paddles.event_id
        AND e.coordinator_id = auth.uid()
    )
  );

-- Strict draw pool: only paddles that paid for this exact item round
CREATE TABLE IF NOT EXISTS auction_item_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES auction_catalog_items(id) ON DELETE CASCADE,
  paddle_id       UUID NOT NULL REFERENCES event_paddles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  paddle_number   TEXT NOT NULL,
  credits_spent   INTEGER NOT NULL CHECK (credits_spent > 0),
  entered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (catalog_item_id, paddle_id)
);

CREATE INDEX IF NOT EXISTS idx_aie_item ON auction_item_entries(catalog_item_id);

ALTER TABLE auction_item_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aie: owner read"
  ON auction_item_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "aie: coordinator read"
  ON auction_item_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auction_catalog_items i
      JOIN events e ON e.id = i.event_id
      WHERE i.id = auction_item_entries.catalog_item_id
        AND e.coordinator_id = auth.uid()
    )
  );

CREATE POLICY "aie: vendor read own item"
  ON auction_item_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auction_catalog_items i
      WHERE i.id = auction_item_entries.catalog_item_id
        AND i.vendor_id = auth.uid()
    )
  );

CREATE POLICY "aie: public count during live"
  ON auction_item_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auction_catalog_items i
      WHERE i.id = auction_item_entries.catalog_item_id
        AND i.status IN ('bidding_open', 'bidding_closed', 'drawing', 'completed')
    )
  );

CREATE POLICY "ep: public paddle numbers for live item"
  ON event_paddles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auction_item_entries e
      JOIN auction_catalog_items i ON i.id = e.catalog_item_id
      WHERE e.paddle_id = event_paddles.id
        AND i.status IN ('bidding_open', 'bidding_closed', 'drawing', 'completed')
    )
  );

-- Strict transaction log view (1 credit = $0.25 = 25 cents)
CREATE OR REPLACE VIEW transaction_log AS
SELECT
  wt.id,
  w.user_id,
  wt.wallet_id,
  wt.type,
  wt.amount AS amount_cents,
  (wt.amount / 25) AS credits,
  wt.square_payment_id,
  wt.metadata,
  wt.created_at
FROM wallet_transactions wt
JOIN wallets w ON w.id = wt.wallet_id;

COMMENT ON VIEW transaction_log IS
  'Audit trail for wallet credits. 1 credit = 25 cents ($0.25). Backed by wallet_transactions.';

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE auction_catalog_items;
ALTER PUBLICATION supabase_realtime ADD TABLE auction_item_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE event_paddles;
