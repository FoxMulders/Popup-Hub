-- Patron wallet balance reclaim at end of event: cash at door, e-transfer, or card refund.

DO $$ BEGIN
  CREATE TYPE wallet_withdrawal_method AS ENUM ('cash_at_door', 'etransfer', 'card_refund');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wallet_withdrawal_status AS ENUM ('pending', 'completed', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS wallet_withdrawal_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_cents          INTEGER NOT NULL CHECK (amount_cents >= 100),
  method                wallet_withdrawal_method NOT NULL,
  status                wallet_withdrawal_status NOT NULL DEFAULT 'pending',
  payout_email          TEXT,
  reference_code        TEXT,
  event_id              UUID REFERENCES events(id) ON DELETE SET NULL,
  confirmed_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  square_refund_id      TEXT,
  expires_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_withdrawal_requests_user
  ON wallet_withdrawal_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_withdrawal_requests_pending
  ON wallet_withdrawal_requests (status, created_at)
  WHERE status = 'pending';

ALTER TABLE wallet_withdrawal_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "wallet_withdrawals: owner read"
    ON wallet_withdrawal_requests FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "wallet_withdrawals: owner insert pending"
    ON wallet_withdrawal_requests FOR INSERT
    TO authenticated
    WITH CHECK (
      auth.uid() = user_id
      AND status = 'pending'::wallet_withdrawal_status
      AND method IN ('etransfer'::wallet_withdrawal_method, 'card_refund'::wallet_withdrawal_method)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "wallet_withdrawals: owner cancel pending"
    ON wallet_withdrawal_requests FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id AND status = 'pending'::wallet_withdrawal_status)
    WITH CHECK (status = 'cancelled'::wallet_withdrawal_status);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "wallet_withdrawals: coordinator read pending"
    ON wallet_withdrawal_requests FOR SELECT
    USING (
      status = 'pending'::wallet_withdrawal_status
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'coordinator'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE wallet_withdrawal_requests IS
  'Patron-initiated wallet balance reclaim: cash at door (instant), e-transfer (coordinator confirms), or card refund.';
