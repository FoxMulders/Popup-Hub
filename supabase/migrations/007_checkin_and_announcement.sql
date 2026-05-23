-- Add check-in tracking to booth applications
ALTER TABLE booth_applications ADD COLUMN IF NOT EXISTS checked_in BOOLEAN NOT NULL DEFAULT FALSE;

-- Add coordinator announcement notification type
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'coordinator_announcement';
