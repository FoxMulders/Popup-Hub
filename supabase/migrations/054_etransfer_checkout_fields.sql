-- E-transfer checkout metadata on applications + optional coordinator payment email.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS etransfer_payment_email TEXT;

COMMENT ON COLUMN profiles.etransfer_payment_email IS
  'Coordinator e-transfer deposit address; falls back to profile email when unset.';

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS etransfer_reference_code TEXT,
  ADD COLUMN IF NOT EXISTS etransfer_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN booth_applications.etransfer_reference_code IS
  '6-character memo code vendors include on e-transfer.';
COMMENT ON COLUMN booth_applications.etransfer_expires_at IS
  '24-hour hold expiry for pending e-transfer verification.';

CREATE INDEX IF NOT EXISTS idx_booth_applications_etransfer_pending
  ON booth_applications (event_id, application_payment_status)
  WHERE payment_method = 'ETRANSFER' AND application_payment_status = 'PENDING_REVIEW';
