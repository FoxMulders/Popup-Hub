-- ============================================================
-- Migration 011: Event cancellation + refund exception audit
-- ============================================================

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'event_cancelled';

DO $$ BEGIN
  CREATE TYPE refund_exception_status AS ENUM ('pending_retry', 'resolved', 'abandoned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS refund_exceptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  booth_application_id UUID NOT NULL REFERENCES booth_applications(id) ON DELETE CASCADE,
  coordinator_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vendor_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  square_payment_id   TEXT NOT NULL,
  amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),
  error_message       TEXT NOT NULL,
  square_refund_id    TEXT,
  status              refund_exception_status NOT NULL DEFAULT 'pending_retry',
  retry_count         INTEGER NOT NULL DEFAULT 0,
  last_retry_at       TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_exceptions_event ON refund_exceptions(event_id);
CREATE INDEX IF NOT EXISTS idx_refund_exceptions_status ON refund_exceptions(event_id, status)
  WHERE status = 'pending_retry';

ALTER TABLE refund_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refund_exceptions: coordinator read own events" ON refund_exceptions
  FOR SELECT USING (auth.uid() = coordinator_id);

CREATE POLICY "refund_exceptions: coordinator update own events" ON refund_exceptions
  FOR UPDATE USING (auth.uid() = coordinator_id);

DROP TRIGGER IF EXISTS trg_refund_exceptions_updated_at ON refund_exceptions;
CREATE TRIGGER trg_refund_exceptions_updated_at
  BEFORE UPDATE ON refund_exceptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE refund_exceptions IS
  'Failed Square refunds during event cancellation; coordinators can retry manually.';
