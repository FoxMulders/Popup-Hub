-- Stripe Connect Express account ID for coordinator payout splits.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_connected_id TEXT;

COMMENT ON COLUMN profiles.stripe_connected_id IS
  'Stripe Connect Express account ID used for coordinator payout onboarding and split transfers.';

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connected_id
  ON profiles (stripe_connected_id)
  WHERE stripe_connected_id IS NOT NULL;
