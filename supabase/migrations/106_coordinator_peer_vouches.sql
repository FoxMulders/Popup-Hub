-- Coordinator peer vouches: community-verified organizers vouch for other organizers.
-- Separate from vendor vouches (coordinator_vouches) so thresholds can differ.

CREATE TABLE IF NOT EXISTS coordinator_peer_vouches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  voucher_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coordinator_peer_vouches_unique UNIQUE (coordinator_id, voucher_id)
);

CREATE INDEX IF NOT EXISTS idx_coordinator_peer_vouches_coordinator
  ON coordinator_peer_vouches (coordinator_id);

ALTER TABLE coordinator_peer_vouches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "peer_vouches: voucher read own" ON coordinator_peer_vouches
  FOR SELECT USING (auth.uid() = voucher_id);

CREATE POLICY "peer_vouches: coordinator read received" ON coordinator_peer_vouches
  FOR SELECT USING (auth.uid() = coordinator_id);

CREATE POLICY "peer_vouches: coordinator insert own" ON coordinator_peer_vouches
  FOR INSERT WITH CHECK (auth.uid() = voucher_id);

COMMENT ON TABLE coordinator_peer_vouches IS
  'Community-verified organizers vouching for other organizers (3 peer vouches unlocks full payouts).';
