-- H1: Wallets are read-only for owners; balance changes go through SECURITY DEFINER RPCs / service role.
-- H2: Restore signup RBAC — vendor role only via accept_vendor_invitation; coordinator via metadata or apply_signup_role.
-- H3: Atomic shopper purchase debit.

-- ── Wallet RLS hardening ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "wallets: owner full access" ON wallets;

CREATE POLICY "wallets: owner read own" ON wallets
  FOR SELECT
  USING (auth.uid() = user_id);

-- ── Signup role assignment (OAuth coordinator selection) ─────────────────────

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
    RAISE EXCEPTION 'Vendor role requires coordinator invitation';
  END IF;

  IF p_role = 'coordinator'::user_role THEN
    UPDATE profiles
    SET role = 'coordinator'::user_role
    WHERE id = auth.uid()
      AND role = 'shopper'::user_role;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_signup_role(user_role) TO authenticated;

-- ── New user bootstrap (never vendor from metadata) ──────────────────────────

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

-- ── Atomic shopper booth purchase ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION record_shopper_purchase(
  p_vendor_id uuid,
  p_amount_cents integer,
  p_event_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_square_payment_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_wallet wallets%ROWTYPE;
  v_purchase_id uuid;
  v_new_balance integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Invalid vendor' USING ERRCODE = '22023';
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents < 1 THEN
    RAISE EXCEPTION 'Invalid amount' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_vendor_id) THEN
    RAISE EXCEPTION 'Vendor not found' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_wallet.balance < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient balance' USING ERRCODE = 'P0001';
  END IF;

  v_new_balance := v_wallet.balance - p_amount_cents;

  UPDATE wallets
  SET balance = v_new_balance
  WHERE id = v_wallet.id;

  INSERT INTO wallet_transactions (
    wallet_id,
    type,
    amount,
    square_payment_id,
    metadata
  )
  VALUES (
    v_wallet.id,
    'withdrawal',
    p_amount_cents,
    p_square_payment_id,
    jsonb_build_object(
      'vendor_id', p_vendor_id,
      'event_id', p_event_id,
      'description', p_description
    )
  );

  INSERT INTO shopper_purchases (
    shopper_id,
    vendor_id,
    event_id,
    amount_cents,
    description,
    square_payment_id
  )
  VALUES (
    v_user_id,
    p_vendor_id,
    p_event_id,
    p_amount_cents,
    p_description,
    p_square_payment_id
  )
  RETURNING id INTO v_purchase_id;

  RETURN jsonb_build_object(
    'purchase_id', v_purchase_id,
    'balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_shopper_purchase(uuid, integer, uuid, text, text) TO authenticated;
