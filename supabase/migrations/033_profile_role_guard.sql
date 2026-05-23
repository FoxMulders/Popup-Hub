-- RBAC: prevent self-service role escalation; vendor role only via invitation RPC.

-- Block direct role changes on self-updates (role changes go through SECURITY DEFINER RPC).
DROP POLICY IF EXISTS "profiles: users update own" ON profiles;

CREATE POLICY "profiles: users update own" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
  );

-- Never bootstrap vendor role from auth metadata — activation workflow only.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_meta_role text;
BEGIN
  v_meta_role := NEW.raw_user_meta_data->>'role';

  IF v_meta_role = 'coordinator' THEN
    v_role := 'coordinator'::user_role;
  ELSE
    v_role := 'shopper'::user_role;
  END IF;

  INSERT INTO profiles (id, role, full_name, email)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Promote shopper → vendor after validating coordinator invitation (bypasses RLS).
CREATE OR REPLACE FUNCTION accept_vendor_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invitation vendor_invitations%ROWTYPE;
  v_request vendor_access_requests%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invitation FROM vendor_invitations WHERE token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invitation';
  END IF;

  IF v_invitation.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already_accepted', true, 'redirect', '/vendor/passport');
  END IF;

  IF v_invitation.expires_at < NOW() THEN
    RAISE EXCEPTION 'Invitation expired';
  END IF;

  SELECT * INTO v_request FROM vendor_access_requests WHERE id = v_invitation.request_id;
  IF NOT FOUND OR v_request.shopper_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Invitation not for this account';
  END IF;

  UPDATE vendor_invitations SET accepted_at = NOW() WHERE id = v_invitation.id;
  UPDATE profiles SET role = 'vendor'::user_role WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'redirect', '/vendor/passport');
END;
$$;

GRANT EXECUTE ON FUNCTION accept_vendor_invitation(text) TO authenticated;
