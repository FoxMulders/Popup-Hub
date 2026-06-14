-- Supabase security linter fixes:
-- 1. coordinator_escrow_holds — enable RLS (table was public without policies).
-- 2. transaction_log view — recreate with security_invoker so wallet RLS applies.

-- ── coordinator_escrow_holds RLS ─────────────────────────────────────────────
-- Inserts/updates/releases use service role (webhooks, cron). Client reads mirror platform_transactions.

ALTER TABLE coordinator_escrow_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escrow_holds: coordinator read own" ON coordinator_escrow_holds
  FOR SELECT USING (auth.uid() = coordinator_id);

CREATE POLICY "escrow_holds: vendor read own transactions" ON coordinator_escrow_holds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM platform_transactions pt
      WHERE pt.id = coordinator_escrow_holds.platform_transaction_id
        AND pt.vendor_id = auth.uid()
    )
  );

-- ── transaction_log: security invoker (respect wallet RLS) ───────────────────
-- CREATE OR REPLACE cannot change security_invoker; drop and recreate.

DROP VIEW IF EXISTS transaction_log;

CREATE VIEW transaction_log
WITH (security_invoker = true) AS
SELECT
  wt.id,
  w.user_id,
  wt.wallet_id,
  wt.type,
  wt.amount AS amount_cents,
  (wt.amount / 25) AS credits,
  wt.square_payment_id,
  wt.metadata,
  wt.created_at
FROM wallet_transactions wt
JOIN wallets w ON w.id = wt.wallet_id;

COMMENT ON VIEW transaction_log IS
  'Audit trail for wallet credits. 1 credit = 25 cents ($0.25). Backed by wallet_transactions.';
