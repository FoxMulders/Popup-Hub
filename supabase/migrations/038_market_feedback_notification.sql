-- Notify coordinators when market feedback is submitted
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'market_feedback';
