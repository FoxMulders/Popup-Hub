-- Vendors may self-signup; juried markets handle booth approval per event.

CREATE OR REPLACE FUNCTION apply_signup_role(p_role user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_role = 'vendor'::user_role THEN
    UPDATE profiles
    SET role = 'vendor'::user_role
    WHERE id = auth.uid()
      AND role = 'shopper'::user_role;
    RETURN;
  END IF;

  IF p_role = 'coordinator'::user_role THEN
    UPDATE profiles
    SET role = 'coordinator'::user_role
    WHERE id = auth.uid()
      AND role = 'shopper'::user_role;
  END IF;
END;
$$;

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

  IF v_meta_role = 'coordinator' THEN
    v_role := 'coordinator'::user_role;
  ELSIF v_meta_role = 'vendor' THEN
    v_role := 'vendor'::user_role;
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
