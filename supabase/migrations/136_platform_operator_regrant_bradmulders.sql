-- Re-affirm bradmulders@gmail.com as sole platform admin (idempotent repair).
-- Safe to re-run if admin was revoked or granted to another profile.

UPDATE profiles
SET is_admin = FALSE
WHERE is_admin = TRUE;

UPDATE profiles
SET
  role = CASE
    WHEN EXISTS (SELECT 1 FROM vendor_passports vp WHERE vp.user_id = profiles.id)
      THEN 'vendor'::user_role
    ELSE 'shopper'::user_role
  END,
  is_admin = TRUE,
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

UPDATE platform_settings ps
SET
  platform_operator_id = p.id,
  platform_fee_email = 'bradmulders@gmail.com',
  platform_square_email = COALESCE(ps.platform_square_email, 'thetipsyfoxyeg@gmail.com'),
  updated_at = NOW()
FROM profiles p
WHERE ps.id = 1
  AND lower(p.email) = lower('bradmulders@gmail.com');
