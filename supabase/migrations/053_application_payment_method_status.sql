-- Application payment method (Square vs e-transfer) and manual review status.

DO $$ BEGIN
  CREATE TYPE application_payment_method AS ENUM ('SQUARE', 'ETRANSFER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE application_payment_status AS ENUM (
    'PENDING_REVIEW',
    'COMPLETED',
    'EXPIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS payment_method application_payment_method,
  ADD COLUMN IF NOT EXISTS application_payment_status application_payment_status;

COMMENT ON COLUMN booth_applications.payment_method IS
  'Vendor-selected checkout path for paid booths: Square card or e-transfer.';
COMMENT ON COLUMN booth_applications.application_payment_status IS
  'Manual payment review for e-transfer applications (PENDING_REVIEW → COMPLETED).';

-- Backfill Square-paid applications.
UPDATE booth_applications
SET
  payment_method = 'SQUARE',
  application_payment_status = 'COMPLETED'
WHERE payment_status = 'paid'
  AND payment_method IS NULL;

-- Backfill Square checkout in progress / required.
UPDATE booth_applications
SET payment_method = 'SQUARE'
WHERE payment_method IS NULL
  AND payment_status IN ('payment_required', 'processing', 'pending');
