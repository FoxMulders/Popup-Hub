-- Create a passport record for every new user; backfill existing profiles.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_meta_role text;
  v_share_contact boolean;
  v_full_name text;
BEGIN
  v_meta_role := lower(COALESCE(NEW.raw_user_meta_data->>'role', ''));

  IF v_meta_role IN ('coordinator', 'vendor') THEN
    v_role := v_meta_role::user_role;
  ELSE
    v_role := 'shopper'::user_role;
  END IF;

  v_share_contact := COALESCE(
    (NEW.raw_user_meta_data->>'share_contact_with_vendors')::boolean,
    false
  );

  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO profiles (id, role, full_name, email, share_contact_with_vendors)
  VALUES (
    NEW.id,
    v_role,
    v_full_name,
    NEW.email,
    v_share_contact
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO vendor_passports (user_id, business_name)
  VALUES (NEW.id, v_full_name)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

INSERT INTO vendor_passports (user_id, business_name)
SELECT p.id, COALESCE(NULLIF(TRIM(p.full_name), ''), '')
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM vendor_passports vp WHERE vp.user_id = p.id
);
