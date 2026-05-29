-- Vendor fraud mitigation: verification fields, account status, booth guards.
-- Payment/approval audit rows live in 084_audit_security_logs.sql (append-only RPC).

DO $$ BEGIN
  CREATE TYPE vendor_verification_status AS ENUM (
    'unverified',
    'pending',
    'verified',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vendor_account_status AS ENUM ('active', 'suspended', 'banned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE vendor_passports
  ADD COLUMN IF NOT EXISTS verification_status vendor_verification_status NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS business_number TEXT,
  ADD COLUMN IF NOT EXISTS social_handle TEXT,
  ADD COLUMN IF NOT EXISTS risk_score SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_status vendor_account_status NOT NULL DEFAULT 'active';

ALTER TABLE vendor_passports
  ADD CONSTRAINT vendor_passports_risk_score_range
  CHECK (risk_score >= 0 AND risk_score <= 100);

COMMENT ON COLUMN vendor_passports.verification_status IS
  'Identity/business verification state for fraud mitigation.';
COMMENT ON COLUMN vendor_passports.business_number IS
  'Business registration / tax identifier for cross-check validation.';
COMMENT ON COLUMN vendor_passports.social_handle IS
  'Primary social handle (@brand) for identity cross-check.';
COMMENT ON COLUMN vendor_passports.risk_score IS
  'Computed fraud risk 0-100; values above 75 block apply and booth assignment.';
COMMENT ON COLUMN vendor_passports.account_status IS
  'active | suspended | banned — dispute/chargeback automation sets suspended.';

-- Backfill verified vendors
UPDATE vendor_passports
SET verification_status = 'verified'
WHERE is_verified = TRUE AND verification_status = 'unverified';

-- Block booth coordinate assignment for high-risk / suspended vendors
CREATE OR REPLACE FUNCTION public.guard_vendor_booth_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_risk SMALLINT;
  v_account vendor_account_status;
BEGIN
  IF NEW.booth_number IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.booth_number IS NOT DISTINCT FROM NEW.booth_number THEN
    RETURN NEW;
  END IF;

  SELECT risk_score, account_status
  INTO v_risk, v_account
  FROM vendor_passports
  WHERE user_id = NEW.vendor_id;

  IF v_account IN ('suspended', 'banned') THEN
    RAISE EXCEPTION 'Vendor account is % — booth assignment blocked', v_account
      USING ERRCODE = 'check_violation';
  END IF;

  IF COALESCE(v_risk, 0) > 75 THEN
    RAISE EXCEPTION 'Vendor risk score too high — booth assignment blocked'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_vendor_booth_assignment ON booth_applications;
CREATE TRIGGER trg_guard_vendor_booth_assignment
  BEFORE INSERT OR UPDATE OF booth_number ON booth_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_vendor_booth_assignment();
