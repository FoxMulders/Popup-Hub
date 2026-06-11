-- Restore coordinator hosting access for the platform operator while keeping is_admin.

UPDATE profiles
SET
  role = 'coordinator'::user_role,
  updated_at = NOW()
WHERE lower(email) = lower('bradmulders@gmail.com');

UPDATE auth.users u
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'coordinator')
WHERE lower(u.email) = lower('bradmulders@gmail.com');
