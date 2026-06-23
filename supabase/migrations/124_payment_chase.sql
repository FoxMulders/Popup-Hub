-- Vendor payment chase: deadlines, reminders, auto-release, multi-channel notifications.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS payment_due_at TIMESTAMPTZ;

COMMENT ON COLUMN events.payment_due_at IS
  'Optional coordinator override — absolute payment deadline for unpaid booth applications on this market.';

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS payment_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_reminder_stage SMALLINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN booth_applications.payment_due_at IS
  'When unpaid payment must be received before auto-release; computed at approval or offline checkout.';
COMMENT ON COLUMN booth_applications.payment_reminder_stage IS
  'Escalating reminder tier sent (0=none, 1=first, 2=24h, 3=final).';

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_due_reminder';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_expired';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'payment_overdue_released';

-- Promote waitlist when any reserved/unpaid application is cancelled (not only approved).
CREATE OR REPLACE FUNCTION promote_waitlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_application booth_applications%ROWTYPE;
BEGIN
  IF OLD.status IS DISTINCT FROM 'cancelled'
     AND NEW.status = 'cancelled'
     AND OLD.status IN ('approved', 'pending_insurance', 'pending') THEN
    SELECT * INTO v_next_application
    FROM booth_applications
    WHERE event_id = NEW.event_id
      AND category_id = NEW.category_id
      AND status = 'waitlisted'
    ORDER BY waitlist_position ASC NULLS LAST, applied_at ASC
    LIMIT 1;

    IF FOUND THEN
      UPDATE booth_applications
      SET status = 'pending', waitlist_position = NULL
      WHERE id = v_next_application.id;

      INSERT INTO notifications (user_id, type, message, metadata)
      VALUES (
        v_next_application.vendor_id,
        'waitlist_triggered',
        'A spot opened up! You''ve been moved from the waitlist — your application is now under review.',
        jsonb_build_object(
          'event_id', NEW.event_id,
          'application_id', v_next_application.id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
