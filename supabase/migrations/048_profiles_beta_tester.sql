-- Early adopter / founding vendor program flag

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_beta_tester BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.is_beta_tester IS
  'Founding vendor beta cohort — unlocks premium-tier bypass (featured placement, priority queue, product caps).';
