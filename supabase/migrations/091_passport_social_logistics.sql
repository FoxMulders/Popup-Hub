-- Public passport storefront fields: Facebook link and vendor electricity flag.

ALTER TABLE vendor_passports
  ADD COLUMN IF NOT EXISTS facebook_url TEXT,
  ADD COLUMN IF NOT EXISTS requires_electricity BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN vendor_passports.facebook_url IS 'Facebook page or profile URL (shown on public passport cards).';
COMMENT ON COLUMN vendor_passports.requires_electricity IS 'Vendor logistics: booth needs electrical hookup.';
