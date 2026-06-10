-- Community escrow + vendor vouch framework for organizer fraud mitigation.
-- coordinator_is_verified: earned-trust flag (vouches or successful events).
-- Escrow holds 75% of organizer payout for unverified coordinators on platform-settled booth fees.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS coordinator_is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coordinator_successful_events_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_coordinator_successful_events_nonneg
  CHECK (coordinator_successful_events_count >= 0);

COMMENT ON COLUMN profiles.coordinator_is_verified IS
  'Community earned-trust flag — vouches or successful events unlock full payout.';
COMMENT ON COLUMN profiles.coordinator_successful_events_count IS
  'Completed markets with escrow released safely; auto-verifies at 2.';

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS escrow_balance INTEGER NOT NULL DEFAULT 0;

ALTER TABLE wallets
  ADD CONSTRAINT wallets_escrow_balance_nonneg
  CHECK (escrow_balance >= 0);

COMMENT ON COLUMN wallets.escrow_balance IS
  'Organizer booth fees held until post-event release or community verification.';

CREATE TABLE IF NOT EXISTS coordinator_vouches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coordinator_vouches_unique UNIQUE (coordinator_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_coordinator_vouches_coordinator
  ON coordinator_vouches (coordinator_id);

ALTER TABLE coordinator_vouches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vouches: vendor read own" ON coordinator_vouches
  FOR SELECT USING (auth.uid() = vendor_id);

CREATE POLICY "vouches: coordinator read received" ON coordinator_vouches
  FOR SELECT USING (auth.uid() = coordinator_id);

CREATE POLICY "vouches: vendor insert own" ON coordinator_vouches
  FOR INSERT WITH CHECK (auth.uid() = vendor_id);

DO $$ BEGIN
  CREATE TYPE coordinator_escrow_settlement_mode AS ENUM ('wallet', 'external_processor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE coordinator_escrow_hold_status AS ENUM ('held', 'released', 'blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS coordinator_escrow_holds (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_transaction_id UUID NOT NULL REFERENCES platform_transactions(id) ON DELETE CASCADE,
  coordinator_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id                UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organizer_payout_cents  INTEGER NOT NULL CHECK (organizer_payout_cents >= 0),
  immediate_release_cents INTEGER NOT NULL DEFAULT 0 CHECK (immediate_release_cents >= 0),
  held_cents              INTEGER NOT NULL DEFAULT 0 CHECK (held_cents >= 0),
  settlement_mode         coordinator_escrow_settlement_mode NOT NULL DEFAULT 'wallet',
  status                  coordinator_escrow_hold_status NOT NULL DEFAULT 'held',
  eligible_release_at     TIMESTAMPTZ NOT NULL,
  released_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coordinator_escrow_holds_tx_unique UNIQUE (platform_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_coordinator_escrow_holds_release
  ON coordinator_escrow_holds (status, eligible_release_at)
  WHERE status = 'held';

-- Backfill community-verified flag from admin verification path.
UPDATE profiles
SET coordinator_is_verified = true
WHERE role = 'coordinator'
  AND coordinator_verification_status = 'verified'
  AND coordinator_is_verified = false;
