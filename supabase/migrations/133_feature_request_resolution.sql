-- User-visible resolution notes and reopen tracking for feature requests

ALTER TABLE feature_requests
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ;

COMMENT ON COLUMN feature_requests.resolution_notes IS
  'User-visible explanation of what was fixed or why declined.';
COMMENT ON COLUMN feature_requests.resolved_at IS
  'When admin marked the request completed or declined.';
COMMENT ON COLUMN feature_requests.reopened_at IS
  'When the submitter last reopened a completed request.';

-- Retroactive: mark all historical completed requests as resolved
UPDATE feature_requests
SET resolved_at = COALESCE(updated_at, created_at)
WHERE status = 'completed' AND resolved_at IS NULL;

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'feature_request_resolved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'feature_request_reopened';
