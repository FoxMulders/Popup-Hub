-- ============================================================
-- Migration 012: Coordinator cancellation accountability
-- ============================================================

DO $$ BEGIN
  CREATE TYPE event_cancellation_reason AS ENUM (
    'force_majeure',
    'low_vendor_turnout',
    'logistical_personal',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS cancellation_reason event_cancellation_reason,
  ADD COLUMN IF NOT EXISTS cancellation_reason_notes TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_notice_days NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS cancellation_penalty_applied INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN events.cancellation_reason IS
  'Coordinator-selected reason when status becomes cancelled.';
COMMENT ON COLUMN events.cancellation_notice_days IS
  'Whole days between cancellation and event start_at (can be fractional).';
COMMENT ON COLUMN events.cancellation_penalty_applied IS
  'Points deducted from coordinator reliability_score for this cancellation.';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS coordinator_cancellation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coordinator_late_cancellation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recent_late_cancellation_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.recent_late_cancellation_at IS
  'Set when a non-emergency cancellation occurs <7 days before an event; powers public warning badge.';

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS event_cancellation_reason event_cancellation_reason,
  ADD COLUMN IF NOT EXISTS event_cancellation_reason_label TEXT;

COMMENT ON COLUMN booth_applications.event_cancellation_reason_label IS
  'Human-readable cancellation reason shown to vendors on their dashboard.';
