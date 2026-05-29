-- Market booth/table pricing and multi-table discount (community markets only in app logic).

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS booth_price_cents INTEGER NOT NULL DEFAULT 0
    CHECK (booth_price_cents >= 0),
  ADD COLUMN IF NOT EXISTS multi_table_discount_percent INTEGER NOT NULL DEFAULT 0
    CHECK (multi_table_discount_percent >= 0 AND multi_table_discount_percent <= 100);

COMMENT ON COLUMN events.booth_price_cents IS
  'Default booth/table fee in cents for community markets. Category limits may override per category.';
COMMENT ON COLUMN events.multi_table_discount_percent IS
  'Percent off total booth fee when a vendor books 2+ tables. Applied only for community_market listing type.';

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS table_count INTEGER NOT NULL DEFAULT 1
    CHECK (table_count >= 1);

COMMENT ON COLUMN booth_applications.table_count IS
  'Number of tables/booth units requested on this application (used for multi-table discount at checkout).';
