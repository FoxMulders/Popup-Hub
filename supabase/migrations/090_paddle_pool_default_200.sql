-- Default quarter-auction paddle pool to full 1–200 range for new events.
ALTER TABLE quarter_auction_settings
  ALTER COLUMN paddle_pool_size SET DEFAULT 200;
