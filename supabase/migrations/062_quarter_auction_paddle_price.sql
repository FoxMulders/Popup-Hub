-- Paddle price: $2.00 = 8 credits (was 4 credits / $1.00).
ALTER TABLE quarter_auction_settings
  ALTER COLUMN paddle_purchase_credits SET DEFAULT 8;

UPDATE quarter_auction_settings
SET paddle_purchase_credits = 8
WHERE paddle_purchase_credits = 4;
