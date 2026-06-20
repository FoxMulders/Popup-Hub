-- HubGuard vendor review notifications (organizer alert + vendor response alert)

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'hubguard_vendor_review';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'hubguard_review_response';
