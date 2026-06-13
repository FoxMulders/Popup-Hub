-- Vendor booth contract signatures: digital canvas sign or uploaded wet-signed copy

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS booth_contract_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booth_contract_signature_method TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booth_applications_booth_contract_signature_method_check'
  ) THEN
    ALTER TABLE booth_applications
      ADD CONSTRAINT booth_applications_booth_contract_signature_method_check
      CHECK (
        booth_contract_signature_method IS NULL
        OR booth_contract_signature_method IN ('digital', 'uploaded')
      );
  END IF;
END $$;

COMMENT ON COLUMN booth_applications.booth_contract_signed_at IS
  'When the vendor digitally signed or uploaded a signed contract copy for the coordinator.';
COMMENT ON COLUMN booth_applications.booth_contract_signature_method IS
  'digital = canvas signature on device; uploaded = printed contract scan/PDF returned to coordinator.';
