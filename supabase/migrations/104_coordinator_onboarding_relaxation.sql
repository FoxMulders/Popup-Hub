-- Relax offline publish trust: organization name alone satisfies publish path
-- (matches lib/coordinator/verification.ts hasOfflineOrganizerProfile).
-- Square/Stripe OAuth paths unchanged.

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

  IF LENGTH(TRIM(COALESCE(v_profile.coordinator_organization_name, ''))) >= 2 THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
