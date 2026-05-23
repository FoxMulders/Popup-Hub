-- Event reminders for shoppers

DO $$ BEGIN
  CREATE TYPE reminder_offset AS ENUM (
    'morning_of',
    'one_day_before',
    'three_days_before',
    'one_week_before'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'market_reminder';

CREATE TABLE IF NOT EXISTS event_reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reminder_offset reminder_offset NOT NULL,
  remind_at       TIMESTAMPTZ NOT NULL,
  sent_at         TIMESTAMPTZ,
  sms_sent        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, event_id, reminder_offset)
);

ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_reminders: owner all" ON event_reminders
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_event_reminders_dispatch
  ON event_reminders(remind_at) WHERE sent_at IS NULL;
