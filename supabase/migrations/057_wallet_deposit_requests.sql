-- Patron wallet top-ups via e-transfer (pending review) or cash at door (instant).

DO $$ BEGIN
  CREATE TYPE wallet_deposit_method AS ENUM ('etransfer', 'cash_at_door');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wallet_deposit_status AS ENUM ('pending', 'completed', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS wallet_deposit_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_cents          INTEGER NOT NULL CHECK (amount_cents >= 100),
  method                wallet_deposit_method NOT NULL,
  status                wallet_deposit_status NOT NULL DEFAULT 'pending',
  reference_code        TEXT,
  event_id              UUID REFERENCES events(id) ON DELETE SET NULL,
  confirmed_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  expires_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_deposit_requests_user
  ON wallet_deposit_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_deposit_requests_pending
  ON wallet_deposit_requests (status, created_at)
  WHERE status = 'pending';

ALTER TABLE wallet_deposit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallet_deposits: owner read"
  ON wallet_deposit_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "wallet_deposits: coordinator read pending"
  ON wallet_deposit_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'coordinator'
    )
  );

COMMENT ON TABLE wallet_deposit_requests IS
  'Patron-initiated wallet top-ups: e-transfer (pending) or cash at door (completed by coordinator).';
