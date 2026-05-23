-- Booth spatial attributes
ALTER TABLE event_category_limits ADD COLUMN IF NOT EXISTS booth_type TEXT NOT NULL DEFAULT 'inside' CHECK (booth_type IN ('inside', 'wall', 'power'));

-- Vendor application logistics fields
ALTER TABLE booth_applications ADD COLUMN IF NOT EXISTS neighbor_preference TEXT;
ALTER TABLE booth_applications ADD COLUMN IF NOT EXISTS load_in_window TEXT;
ALTER TABLE booth_applications ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE booth_applications ADD COLUMN IF NOT EXISTS left_early BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE booth_applications ADD COLUMN IF NOT EXISTS raffle_donation_received BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE booth_applications ADD COLUMN IF NOT EXISTS booth_cleared BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE booth_applications ADD COLUMN IF NOT EXISTS booth_cleared_photo_url TEXT;
ALTER TABLE booth_applications ADD COLUMN IF NOT EXISTS booth_cleared_at TIMESTAMPTZ;

-- Vendor reliability score on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reliability_score INTEGER NOT NULL DEFAULT 100;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_markets INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS no_show_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS left_early_count INTEGER NOT NULL DEFAULT 0;

-- FCFS queue: preference field
ALTER TABLE booth_applications ADD COLUMN IF NOT EXISTS requested_booth_type TEXT CHECK (requested_booth_type IN ('inside', 'wall', 'power', 'any'));

-- NOTE: The `booth-clearance-photos` storage bucket must be created manually in the
-- Supabase Dashboard → Storage → New Bucket → name: `booth-clearance-photos` → Public.
