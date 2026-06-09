-- Platform operator: sole admin + coordinator payout account (bradmulders@gmail.com)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Only one admin — clear any prior grants.
UPDATE profiles
SET is_admin = FALSE
WHERE is_admin = TRUE;

UPDATE profiles
SET
  is_admin = TRUE,
  role = 'coordinator'::user_role,
  etransfer_payment_email = 'bradmulders@gmail.com',
  updated_at = NOW()
WHERE lower(email) = lower('bradmulders@gmail.com');

-- Keep auth metadata aligned so new sessions land on coordinator portal.
UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'coordinator')
WHERE lower(email) = lower('bradmulders@gmail.com');

CREATE TABLE IF NOT EXISTS platform_settings (
  id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payout_coordinator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE platform_settings IS
  'Singleton platform configuration. payout_coordinator_id receives coordinator-facing platform payouts.';

INSERT INTO platform_settings (id, payout_coordinator_id, updated_at)
SELECT 1, p.id, NOW()
FROM profiles p
WHERE lower(p.email) = lower('bradmulders@gmail.com')
ON CONFLICT (id) DO UPDATE
SET
  payout_coordinator_id = EXCLUDED.payout_coordinator_id,
  updated_at = NOW();

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings: admin read" ON platform_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );
