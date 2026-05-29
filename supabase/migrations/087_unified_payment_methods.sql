-- Unified payment methods: Square + Stripe Connect + offline e-Transfer/Cash.
-- Platform fee (3% + $1) applies on all paths; offline fees debit coordinator wallet.

ALTER TYPE application_payment_method ADD VALUE IF NOT EXISTS 'STRIPE';
ALTER TYPE application_payment_method ADD VALUE IF NOT EXISTS 'CASH';

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'failed';

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS accepts_square BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_stripe BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_offline_etransfer BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_offline_cash BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.accepts_square IS 'Vendor checkout may use Square card payments.';
COMMENT ON COLUMN events.accepts_stripe IS 'Vendor checkout may use Stripe Connect card payments.';
COMMENT ON COLUMN events.accepts_offline_etransfer IS 'Vendor checkout may use Interac e-Transfer (manual coordinator clearance).';
COMMENT ON COLUMN events.accepts_offline_cash IS 'Vendor checkout may pay cash in person (manual coordinator clearance).';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS offline_payment_instructions TEXT,
  ADD COLUMN IF NOT EXISTS platform_wallet_grace_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS platform_wallet_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profiles.offline_payment_instructions IS 'Coordinator copy shown to vendors who pick offline e-Transfer or cash.';
COMMENT ON COLUMN profiles.platform_wallet_grace_until IS 'When set, coordinator wallet may go negative until this time after offline fee debits.';
COMMENT ON COLUMN profiles.platform_wallet_blocked IS 'Blocks new vendor approvals until coordinator tops up platform wallet.';

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT;

CREATE INDEX IF NOT EXISTS idx_booth_applications_stripe_payment_id
  ON booth_applications (stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

-- idx_booth_applications_offline_pending is in 089: new enum values cannot be
-- referenced in the same transaction as ALTER TYPE ... ADD VALUE.
