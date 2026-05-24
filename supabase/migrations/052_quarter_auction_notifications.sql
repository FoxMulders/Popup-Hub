-- Apply share_contact_with_vendors from signup metadata on new user creation

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

  INSERT INTO profiles (id, role, full_name, email, share_contact_with_vendors)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    v_share_contact
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
