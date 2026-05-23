-- Vendor passport external links for shopper roster

ALTER TABLE vendor_passports
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS shop_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT;

COMMENT ON COLUMN vendor_passports.website_url IS 'Public business website (shown on market vendor roster).';
COMMENT ON COLUMN vendor_passports.shop_url IS 'Online shop URL e.g. Etsy, Shopify.';
COMMENT ON COLUMN vendor_passports.instagram_url IS 'Instagram profile URL.';
