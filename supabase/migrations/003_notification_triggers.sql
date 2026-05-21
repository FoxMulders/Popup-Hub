-- ── Migration 003: Notification triggers ─────────────────────────────────────
-- Fires DB-level notifications for:
--   1. Booth application status changes (approved / rejected / waitlisted)
--   2. Auction winner selection (auction_won for winner)
--   3. New auction starting (auction_starting for all attendees / wallet holders)

-- ── 1. Application status change → notify vendor ──────────────────────────────
CREATE OR REPLACE FUNCTION notify_application_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_name TEXT;
  v_msg TEXT;
  v_type notification_type;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_event_name FROM events WHERE id = NEW.event_id;

  CASE NEW.status
    WHEN 'approved' THEN
      v_type := 'application_approved';
      v_msg  := 'Your application for "' || COALESCE(v_event_name, 'the event') || '" has been approved! Get ready to set up your booth.';
    WHEN 'rejected' THEN
      v_type := 'application_rejected';
      v_msg  := 'Your application for "' || COALESCE(v_event_name, 'the event') || '" was not approved this time.';
    WHEN 'waitlisted' THEN
      v_type := 'waitlist_triggered';
      v_msg  := 'You''re on the waitlist for "' || COALESCE(v_event_name, 'the event') || '". We''ll notify you if a spot opens up!';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO notifications (user_id, type, message, metadata)
  VALUES (
    NEW.vendor_id,
    v_type,
    v_msg,
    jsonb_build_object(
      'event_id',       NEW.event_id,
      'application_id', NEW.id,
      'old_status',     OLD.status,
      'new_status',     NEW.status
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_application_status_notify ON booth_applications;
CREATE TRIGGER trg_application_status_notify
  AFTER UPDATE OF status ON booth_applications
  FOR EACH ROW EXECUTE FUNCTION notify_application_status_change();


-- ── 2. Auction ends → notify winner ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_auction_winner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_name TEXT;
  v_pot_cents  INTEGER;
BEGIN
  -- Fire only when winner_id is newly set (auction just ended)
  IF NEW.winner_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.winner_id IS NOT DISTINCT FROM NEW.winner_id THEN
    RETURN NEW;
  END IF;

  SELECT e.name, a.pot_cents
    INTO v_event_name, v_pot_cents
    FROM events e
    JOIN auctions a ON a.id = NEW.id
   WHERE e.id = NEW.event_id;

  INSERT INTO notifications (user_id, type, message, metadata)
  VALUES (
    NEW.winner_id,
    'auction_won',
    'You won the quarter auction at "' || COALESCE(v_event_name, 'the event') || '"! 🎉 '
      || 'Your prize is worth $' || (COALESCE(v_pot_cents, 0) / 100.0)::NUMERIC(10,2)::TEXT || '.',
    jsonb_build_object(
      'auction_id', NEW.id,
      'event_id',   NEW.event_id,
      'pot_cents',  v_pot_cents
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auction_winner_notify ON auctions;
CREATE TRIGGER trg_auction_winner_notify
  AFTER UPDATE OF winner_id ON auctions
  FOR EACH ROW EXECUTE FUNCTION notify_auction_winner();


-- ── 3. Payment received → notify coordinator ──────────────────────────────────
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_name    TEXT;
  v_vendor_name   TEXT;
  v_coordinator   UUID;
BEGIN
  -- Trigger after a booth application transitions to 'approved' via payment
  -- (We re-use the application_approved trigger for vendors; here we notify
  --  the coordinator that a payment landed.)
  IF NEW.status <> 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT e.name, e.coordinator_id
    INTO v_event_name, v_coordinator
    FROM events e WHERE e.id = NEW.event_id;

  SELECT full_name INTO v_vendor_name
    FROM profiles WHERE id = NEW.vendor_id;

  IF v_coordinator IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, message, metadata)
  VALUES (
    v_coordinator,
    'payment_received',
    COALESCE(v_vendor_name, 'A vendor') || ' paid for a booth at "' || COALESCE(v_event_name, 'your event') || '".',
    jsonb_build_object(
      'application_id', NEW.id,
      'event_id',       NEW.event_id,
      'vendor_id',      NEW.vendor_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_received_notify ON booth_applications;
CREATE TRIGGER trg_payment_received_notify
  AFTER UPDATE OF status ON booth_applications
  FOR EACH ROW EXECUTE FUNCTION notify_payment_received();


-- ── Ensure notification_type has all values we reference ──────────────────────
-- Add missing values if they don't already exist (idempotent with DO block)
DO $$
BEGIN
  -- 'application_approved' / 'application_rejected' / 'payment_received'
  -- were already defined in 001 migration's enum. Verify and add any missing:
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'payment_received'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'payment_received';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'application_approved'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'application_approved';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'application_rejected'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'application_rejected';
  END IF;
END;
$$;
