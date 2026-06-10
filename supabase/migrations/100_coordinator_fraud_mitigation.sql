-- Coordinator fraud mitigation: verification fields, account status, publish guards.
-- Trust paths (any ONE for publish): admin-verified, Stripe onboarding complete,
-- Square connected, or offline organizer profile (org name + business number submitted).
-- Payment collection additionally requires verified / Stripe / Square (not pending offline-only).

DO $$ BEGIN
  CREATE TYPE coordinator_verification_status AS ENUM (
    'unverified',
    'pending',
    'verified',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE coordinator_account_status AS ENUM ('active', 'suspended', 'banned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS coordinator_verification_status coordinator_verification_status NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS coordinator_organization_name TEXT,
  ADD COLUMN IF NOT EXISTS coordinator_business_number TEXT,
  ADD COLUMN IF NOT EXISTS coordinator_risk_score SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coordinator_account_status coordinator_account_status NOT NULL DEFAULT 'active';

ALTER TABLE profiles
  ADD CONSTRAINT profiles_coordinator_risk_score_range
  CHECK (coordinator_risk_score >= 0 AND coordinator_risk_score <= 100);

COMMENT ON COLUMN profiles.coordinator_verification_status IS
  'Organizer identity verification — unverified | pending | verified | rejected.';
COMMENT ON COLUMN profiles.coordinator_organization_name IS
  'Legal or trade name for offline / manual organizer verification.';
COMMENT ON COLUMN profiles.coordinator_business_number IS
  'Business registration / tax ID (BN/EIN) for organizer verification.';
COMMENT ON COLUMN profiles.coordinator_risk_score IS
  'Computed fraud risk 0-100; values above 75 block publish and payment collection.';
COMMENT ON COLUMN profiles.coordinator_account_status IS
  'active | suspended | banned — admin enforcement for fraudulent coordinators.';

-- Conservative backfill: existing coordinators with established payment or venue-verified markets.
UPDATE profiles p
SET coordinator_verification_status = 'verified'
WHERE p.role = 'coordinator'
  AND p.coordinator_verification_status = 'unverified'
  AND (
    p.stripe_onboarding_complete = TRUE
    OR (p.square_access_token IS NOT NULL AND p.payout_onboarding_status = 'complete')
    OR EXISTS (
      SELECT 1
      FROM events e
      WHERE e.coordinator_id = p.id
        AND e.status IN ('published', 'active')
        AND e.venue_verified = TRUE
    )
  );

CREATE OR REPLACE FUNCTION public.coordinator_can_publish_event(p_coordinator_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_has_square_event BOOLEAN;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_coordinator_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_profile.coordinator_account_status IN ('suspended', 'banned') THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(v_profile.coordinator_risk_score, 0) > 75 THEN
    RETURN FALSE;
  END IF;

  IF v_profile.coordinator_verification_status = 'verified' THEN
    RETURN TRUE;
  END IF;

  IF v_profile.stripe_onboarding_complete = TRUE THEN
    RETURN TRUE;
  END IF;

  IF v_profile.square_access_token IS NOT NULL
     AND v_profile.payout_onboarding_status = 'complete' THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM events e
    WHERE e.coordinator_id = p_coordinator_id
      AND e.square_merchant_id IS NOT NULL
  ) INTO v_has_square_event;

  IF v_has_square_event THEN
    RETURN TRUE;
  END IF;

  IF COALESCE(TRIM(v_profile.coordinator_organization_name), '') <> ''
     AND COALESCE(TRIM(v_profile.coordinator_business_number), '') <> '' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_coordinator_event_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('published', 'active')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.status IN ('published', 'active')
     AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('published', 'active')) THEN
    IF NOT public.coordinator_can_publish_event(NEW.coordinator_id) THEN
      RAISE EXCEPTION 'Organizer verification required before publishing this market'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_coordinator_event_publish ON events;
CREATE TRIGGER trg_guard_coordinator_event_publish
  BEFORE INSERT OR UPDATE OF status ON events
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_coordinator_event_publish();
