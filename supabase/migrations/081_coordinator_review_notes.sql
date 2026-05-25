ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS coordinator_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS coordinator_decline_message TEXT;

COMMENT ON COLUMN booth_applications.coordinator_review_notes IS
  'Private coordinator notes while reviewing this booth application.';

COMMENT ON COLUMN booth_applications.coordinator_decline_message IS
  'Optional message sent to the vendor when the application is declined.';
