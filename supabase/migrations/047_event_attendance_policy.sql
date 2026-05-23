-- Coordinator attendance policy and vendor-selected market days on applications

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS require_full_attendance BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN events.require_full_attendance IS
  'When true, vendors must commit to all scheduled event days. When false, partial-day applications are allowed.';

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS attending_event_day_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS attending_dates DATE[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS attendance_terms_acknowledged_at TIMESTAMPTZ;

COMMENT ON COLUMN booth_applications.attending_event_day_ids IS
  'event_days.id values the vendor selected (multi-day markets).';
COMMENT ON COLUMN booth_applications.attending_dates IS
  'Calendar dates the vendor committed to attend (YYYY-MM-DD).';
COMMENT ON COLUMN booth_applications.attendance_terms_acknowledged_at IS
  'Timestamp when the vendor accepted attendance terms at application submit.';
