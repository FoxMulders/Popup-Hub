-- Remove platform operator personal email from coordinator-facing payment fields.

UPDATE profiles
SET
  etransfer_payment_email = NULL,
  payment_instructions = NULL,
  offline_payment_instructions = NULL,
  updated_at = NOW()
WHERE lower(etransfer_payment_email) = lower('bradmulders@gmail.com')
   OR payment_instructions ILIKE '%bradmulders%'
   OR offline_payment_instructions ILIKE '%bradmulders%';
