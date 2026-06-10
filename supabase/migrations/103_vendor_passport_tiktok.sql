-- Vendor passport TikTok profile link for public passport cards.

ALTER TABLE vendor_passports
  ADD COLUMN IF NOT EXISTS tiktok_url TEXT;

COMMENT ON COLUMN vendor_passports.tiktok_url IS 'TikTok profile URL (shown on public passport cards).';
