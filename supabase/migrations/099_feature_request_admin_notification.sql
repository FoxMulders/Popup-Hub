-- Notify platform admins when a site-wide feature request is submitted

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'feature_request_submitted';
