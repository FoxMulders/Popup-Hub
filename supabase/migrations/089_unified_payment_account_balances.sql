-- Unified market payment flags, coordinator payment instructions, and account_balances
-- for consolidated platform-fee billing. Idempotent; backfills from migration 087 columns.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS accepts_credit_card BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_etransfer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_cash BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.accepts_credit_card IS
  'Vendor checkout may pay by card (Square and/or Stripe Connect when connected).';
COMMENT ON COLUMN events.accepts_etransfer IS
  'Vendor checkout may use Interac e-Transfer (manual coordinator clearance).';
COMMENT ON COLUMN events.accepts_cash IS
  'Vendor checkout may pay cash in person (manual coordinator clearance).';

-- Preserve deployed 087 semantics when backfilling from legacy columns.
UPDATE events
SET
  accepts_credit_card = COALESCE(accepts_square, true) OR COALESCE(accepts_stripe, false),
  accepts_etransfer = COALESCE(accepts_offline_etransfer, accepts_etransfer),
  accepts_cash = COALESCE(accepts_offline_cash, accepts_cash)
WHERE
  accepts_square IS NOT NULL
  OR accepts_stripe IS NOT NULL
  OR accepts_offline_etransfer IS NOT NULL
  OR accepts_offline_cash IS NOT NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

COMMENT ON COLUMN profiles.payment_instructions IS
  'Coordinator copy shown to vendors who pick offline e-Transfer or cash.';

UPDATE profiles
SET payment_instructions = offline_payment_instructions
WHERE payment_instructions IS NULL
  AND offline_payment_instructions IS NOT NULL;

CREATE TABLE IF NOT EXISTS account_balances (
  coordinator_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance_owed NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (balance_owed >= 0),
  last_invoiced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE account_balances IS
  'Accumulated Popup Hub platform fees owed by coordinators (offline mark-as-paid path).';
COMMENT ON COLUMN account_balances.balance_owed IS
  'Outstanding platform fee balance in CAD dollars.';
COMMENT ON COLUMN account_balances.last_invoiced_at IS
  'When the coordinator was last invoiced or balance was reset after collection.';

CREATE INDEX IF NOT EXISTS idx_account_balances_balance_due
  ON account_balances (balance_owed)
  WHERE balance_owed > 0;

ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_balances_coordinator_read ON account_balances;
CREATE POLICY account_balances_coordinator_read ON account_balances
  FOR SELECT
  USING (coordinator_id = auth.uid());

DROP POLICY IF EXISTS account_balances_service_all ON account_balances;
CREATE POLICY account_balances_service_all ON account_balances
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- booth_applications.payment_method (SQUARE|STRIPE|ETRANSFER|CASH) maps to vendor-facing
-- credit_card | etransfer | cash; payment_status pending + application_payment_status
-- PENDING_REVIEW maps to pending_payment; paid + COMPLETED maps to paid.
