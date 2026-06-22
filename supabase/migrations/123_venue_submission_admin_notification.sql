-- Notify platform admins when a coordinator submits a new venue for review

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'venue_submission_pending';
