-- Platform operator retains admin ops while keeping patron-level market favorites access.
-- shopper_favorites RLS only requires auth.uid() = user_id; ensure role stays patron-capable.

UPDATE profiles
SET
  role = CASE
    WHEN EXISTS (SELECT 1 FROM vendor_passports vp WHERE vp.user_id = profiles.id)
      THEN 'vendor'::user_role
    ELSE 'shopper'::user_role
  END,
  is_admin = TRUE,
  updated_at = NOW()
WHERE lower(email) = lower('bradmulders@gmail.com');
