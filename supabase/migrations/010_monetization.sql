-- ============================================================
-- Migration 010: Hybrid Freemium / Commission Monetization
-- ============================================================
-- Product mapping:
--   markets  → public.events (listing is free; draft until published)
--   organizers → profiles.role = 'coordinator'
--   Stripe Connect → Square Connect (square_merchant_id / payout_account_id)
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE payout_onboarding_status AS ENUM (
    'not_started',
    'pending',
    'complete',
    'restricted'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_fee_mode AS ENUM ('percent', 'flat', 'greater_of');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_transaction_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend payment_status for booth applications (vendor checkout lifecycle)
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'processing';

-- ── Coordinator payout profile (extends profiles) ─────────────
-- Square Connect account ID = stripe_connect_id equivalent

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payout_account_id TEXT,
  ADD COLUMN IF NOT EXISTS payout_onboarding_status payout_onboarding_status NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN profiles.payout_account_id IS
  'Square merchant ID for payouts (Stripe Connect account equivalent).';
COMMENT ON COLUMN profiles.payout_onboarding_status IS
  'Organizer Connect onboarding: not_started → pending → complete.';

-- Backfill coordinator payout status from existing event merchant IDs
UPDATE profiles p
SET
  payout_account_id = sub.square_merchant_id,
  payout_onboarding_status = 'complete'
FROM (
  SELECT coordinator_id, MAX(square_merchant_id) AS square_merchant_id
  FROM events
  WHERE square_merchant_id IS NOT NULL
  GROUP BY coordinator_id
) sub
WHERE p.id = sub.coordinator_id
  AND p.role = 'coordinator'
  AND p.payout_account_id IS NULL;

-- ── Events (= markets): per-event fee configuration ───────────
-- Listing remains free; fees apply only on paid booth applications.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS platform_fee_mode platform_fee_mode NOT NULL DEFAULT 'greater_of',
  ADD COLUMN IF NOT EXISTS platform_fee_flat_cents INTEGER NOT NULL DEFAULT 500
    CHECK (platform_fee_flat_cents >= 0),
  ADD COLUMN IF NOT EXISTS platform_fee_bps INTEGER NOT NULL DEFAULT 500
    CHECK (platform_fee_bps >= 0 AND platform_fee_bps <= 10000),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON TABLE events IS
  'Markets / pop-up events. status draft = private listing; published+ = public (free to list).';
COMMENT ON COLUMN events.platform_fee_mode IS
  'percent = % only; flat = fixed fee; greater_of = max(percent, flat) per booth payment.';
COMMENT ON COLUMN events.platform_fee_flat_cents IS
  'Flat platform fee in cents (default $5.00 = 500).';
COMMENT ON COLUMN events.platform_fee_bps IS
  'Percent fee in basis points (500 = 5%).';

-- ── Booth applications: payment lifecycle + audit link ────────

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS platform_transaction_id UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── Platform transactions (fee split audit log) ───────────────

CREATE TABLE IF NOT EXISTS platform_transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booth_application_id    UUID REFERENCES booth_applications(id) ON DELETE SET NULL,
  event_id                UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coordinator_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id             UUID REFERENCES categories(id) ON DELETE SET NULL,
  total_amount_charged    INTEGER NOT NULL CHECK (total_amount_charged >= 0),
  organizer_payout_amount INTEGER NOT NULL CHECK (organizer_payout_amount >= 0),
  platform_fee_retained   INTEGER NOT NULL CHECK (platform_fee_retained >= 0),
  fee_mode_used           platform_fee_mode NOT NULL,
  -- Square IDs (Stripe Connect charge/transfer equivalents)
  processor_charge_id     TEXT,
  processor_transfer_id   TEXT,
  status                  platform_transaction_status NOT NULL DEFAULT 'pending',
  currency                TEXT NOT NULL DEFAULT 'USD',
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_tx_amounts_check CHECK (
    organizer_payout_amount + platform_fee_retained = total_amount_charged
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_tx_event ON platform_transactions(event_id);
CREATE INDEX IF NOT EXISTS idx_platform_tx_vendor ON platform_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_platform_tx_coordinator ON platform_transactions(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_platform_tx_application ON platform_transactions(booth_application_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_tx_charge_id
  ON platform_transactions(processor_charge_id)
  WHERE processor_charge_id IS NOT NULL;

ALTER TABLE booth_applications
  DROP CONSTRAINT IF EXISTS booth_applications_platform_transaction_id_fkey;

ALTER TABLE booth_applications
  ADD CONSTRAINT booth_applications_platform_transaction_id_fkey
  FOREIGN KEY (platform_transaction_id)
  REFERENCES platform_transactions(id)
  ON DELETE SET NULL;

ALTER TABLE platform_transactions ENABLE ROW LEVEL SECURITY;

-- Vendors: read only their own payment audit rows
CREATE POLICY "platform_tx: vendor read own" ON platform_transactions
  FOR SELECT USING (auth.uid() = vendor_id);

-- Organizers: read all transactions for their markets (events)
CREATE POLICY "platform_tx: coordinator read own events" ON platform_transactions
  FOR SELECT USING (auth.uid() = coordinator_id);

-- Service role / backend inserts (no direct client INSERT for users)
-- Webhook uses service role key which bypasses RLS.

-- ── RLS: tighten booth_applications (documented requirements) ─
-- Existing policies already enforce:
--   vendors → own applications (SELECT/INSERT/limited UPDATE)
--   coordinators → applications for their events (ALL)
-- Add explicit vendor payment_status self-read is covered by vendor see own.

-- Coordinators: ensure they can read applications only for their events (already via ALL policy)

-- ── updated_at trigger ───────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_booth_applications_updated_at ON booth_applications;
CREATE TRIGGER trg_booth_applications_updated_at
  BEFORE UPDATE ON booth_applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_platform_transactions_updated_at ON platform_transactions;
CREATE TRIGGER trg_platform_transactions_updated_at
  BEFORE UPDATE ON platform_transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Helper: compute platform fee for an event ─────────────────

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
    WHEN 'greater_of' THEN RETURN GREATEST(v_flat, v_percent_fee);
    ELSE RETURN GREATEST(v_flat, v_percent_fee);
  END CASE;
END;
$$;
