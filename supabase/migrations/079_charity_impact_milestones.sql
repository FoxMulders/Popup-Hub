-- Optional per-event charity milestone overrides for the impact tracker.

ALTER TABLE quarter_auction_settings
  ADD COLUMN IF NOT EXISTS charity_milestones JSONB;

COMMENT ON COLUMN quarter_auction_settings.charity_milestones IS
  'Optional [{ "amount_cents": 50000, "label": "Community Garden Beds" }, ...] sorted by amount.';
