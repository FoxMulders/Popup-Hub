-- Advertised auction start times: catalog and timer auctions cannot go live before this.

ALTER TABLE quarter_auction_settings
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;

COMMENT ON COLUMN quarter_auction_settings.scheduled_start_at IS
  'Advertised quarter auction start; catalog items cannot activate or open bidding before this time.';

ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;

COMMENT ON COLUMN auctions.scheduled_start_at IS
  'Advertised start time; manual start is blocked until this moment.';
