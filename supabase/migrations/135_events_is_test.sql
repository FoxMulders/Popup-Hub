-- QA/scenario markets — bulk-delete before public launch via purge-test-markets script.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.is_test IS
  'QA/scenario markets — bulk-delete before public launch via purge-test-markets script.';

CREATE INDEX IF NOT EXISTS idx_events_is_test ON events (is_test) WHERE is_test = true;
