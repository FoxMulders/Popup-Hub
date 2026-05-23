-- ============================================================
-- Migration 035: percent_plus_flat fee mode + payment_required status
-- Platform fee default: 3% + $1.00 per booth
-- ============================================================

ALTER TYPE platform_fee_mode ADD VALUE IF NOT EXISTS 'percent_plus_flat';

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'payment_required';

-- Coordinator Square OAuth credentials (service-role access only in app code)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS square_access_token TEXT,
  ADD COLUMN IF NOT EXISTS square_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS square_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS square_location_id TEXT;

COMMENT ON COLUMN profiles.square_access_token IS
  'Square OAuth access token for coordinator payments. Never expose to client.';
COMMENT ON COLUMN profiles.square_location_id IS
  'Primary Square location ID for Web Payments SDK on coordinator account.';

-- New event defaults: 3% + $1.00
ALTER TABLE events
  ALTER COLUMN platform_fee_mode SET DEFAULT 'percent_plus_flat',
  ALTER COLUMN platform_fee_flat_cents SET DEFAULT 100,
  ALTER COLUMN platform_fee_bps SET DEFAULT 300;

UPDATE events
SET
  platform_fee_mode = 'percent_plus_flat',
  platform_fee_flat_cents = 100,
  platform_fee_bps = 300
WHERE platform_fee_mode = 'greater_of'
  AND platform_fee_flat_cents = 500
  AND platform_fee_bps = 500;

CREATE OR REPLACE FUNCTION compute_platform_fee_cents(
  p_event_id UUID,
  p_booth_price_cents INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_mode platform_fee_mode;
  v_flat INTEGER;
  v_bps INTEGER;
  v_percent_fee INTEGER;
BEGIN
  SELECT platform_fee_mode, platform_fee_flat_cents, platform_fee_bps
    INTO v_mode, v_flat, v_bps
    FROM events
   WHERE id = p_event_id;

  v_percent_fee := ROUND((p_booth_price_cents::NUMERIC * v_bps) / 10000);

  CASE v_mode
    WHEN 'percent' THEN RETURN v_percent_fee;
    WHEN 'flat' THEN RETURN v_flat;
    WHEN 'percent_plus_flat' THEN RETURN v_percent_fee + v_flat;
    WHEN 'greater_of' THEN RETURN GREATEST(v_flat, v_percent_fee);
    ELSE RETURN v_percent_fee + v_flat;
  END CASE;
END;
$$;
