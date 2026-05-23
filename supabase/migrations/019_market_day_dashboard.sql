-- Market Day Operations dashboard: vendor/coordinator metrics + ops fields

DO $$ BEGIN
  CREATE TYPE load_in_status AS ENUM ('on_time', 'late', 'missed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS late_arrival_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS poor_cleanup_strike_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN profiles.late_arrival_count IS
  'Vendor metric: load-in arrivals recorded as late.';
COMMENT ON COLUMN profiles.poor_cleanup_strike_count IS
  'Vendor metric: failed or disputed booth cleanup incidents.';

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS raffle_donation_requirement TEXT;

COMMENT ON COLUMN events.raffle_donation_requirement IS
  'Coordinator text describing the raffle item each vendor must donate.';

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS load_in_status load_in_status,
  ADD COLUMN IF NOT EXISTS early_departure_notes TEXT;

COMMENT ON COLUMN booth_applications.neighbor_preference IS
  'Stand Beside preference: vendor name or business the applicant wants adjacent to.';
