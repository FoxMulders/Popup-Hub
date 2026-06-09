-- Platform operator is admin only — not a market host.
-- Card fees (3% + $1) settle to Popup Hub Stripe/Square merchant accounts (env keys),
-- not via coordinator Connect payout profiles.

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS platform_operator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platform_fee_email TEXT;

COMMENT ON COLUMN platform_settings.platform_operator_id IS
  'Popup Hub platform admin profile (feature triage, ops). Does not host markets.';
COMMENT ON COLUMN platform_settings.platform_fee_email IS
  'Owner contact for platform fee settlement (Stripe/Square dashboard accounts).';

UPDATE platform_settings ps
SET
  platform_operator_id = p.id,
  platform_fee_email = 'bradmulders@gmail.com',
  updated_at = NOW()
FROM profiles p
WHERE ps.id = 1
  AND lower(p.email) = lower('bradmulders@gmail.com');

-- Revert mistaken coordinator promotion for the platform operator login.
UPDATE profiles
SET
  role = CASE
    WHEN EXISTS (SELECT 1 FROM vendor_passports vp WHERE vp.user_id = profiles.id)
      THEN 'vendor'::user_role
    ELSE 'shopper'::user_role
  END,
  etransfer_payment_email = NULL,
  updated_at = NOW()
WHERE lower(email) = lower('bradmulders@gmail.com');

UPDATE auth.users u
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
  'role',
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM profiles p
      JOIN vendor_passports vp ON vp.user_id = p.id
      WHERE p.id = u.id
    ) THEN 'vendor'
    ELSE 'shopper'
  END
)
WHERE lower(u.email) = lower('bradmulders@gmail.com');

UPDATE profiles
SET is_admin = TRUE
WHERE lower(email) = lower('bradmulders@gmail.com');
