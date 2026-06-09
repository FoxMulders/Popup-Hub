-- Square platform fees (appFeeMoney) settle to the Popup Hub Square application (The Tipsy Fox).
-- platform_fee_email is the platform admin contact (bradmulders@gmail.com) — not a Stripe settlement account.

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS platform_square_email TEXT NOT NULL DEFAULT 'thetipsyfoxyeg@gmail.com';

COMMENT ON COLUMN platform_settings.platform_square_email IS
  'Owner contact for Popup Hub Square application (appFeeMoney). Active platform fee rail for this operator.';

COMMENT ON COLUMN platform_settings.platform_fee_email IS
  'Platform admin contact email (is_admin ops). Not used for Stripe/Square fee settlement for this operator.';

UPDATE platform_settings
SET
  platform_square_email = 'thetipsyfoxyeg@gmail.com',
  updated_at = NOW()
WHERE id = 1;
