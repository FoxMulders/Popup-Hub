-- Vendor documentation & market insurance workflow

ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'pending_insurance';

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS requires_documentation BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS market_insurance_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS applicable_documentation_url TEXT,
  ADD COLUMN IF NOT EXISTS market_insurance_url TEXT;

COMMENT ON COLUMN categories.requires_documentation IS
  'When true, vendors must upload permits/documentation when applying under this category.';
COMMENT ON COLUMN events.market_insurance_required IS
  'When true, approved vendors must upload market insurance before final approval.';
COMMENT ON COLUMN booth_applications.applicable_documentation_url IS
  'Permits/documentation uploaded at application time for regulated categories.';
COMMENT ON COLUMN booth_applications.market_insurance_url IS
  'Proof of market insurance uploaded after coordinator approval.';

-- Regulated vendor categories
INSERT INTO public.categories (name, sort_order, is_mlm, requires_documentation) VALUES
  ('Food (Truck)',       33, false, true),
  ('Beverage (Truck)',   34, false, true),
  ('Piercing Artist',    35, false, true),
  ('Tattoo Artist',      36, false, true)
ON CONFLICT (name) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  requires_documentation = EXCLUDED.requires_documentation;

UPDATE public.categories
SET requires_documentation = true
WHERE name IN ('Alcohol', 'Food & Beverage');

-- Allow PDF + images for application documents in vendor-assets
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]::text[]
WHERE id = 'vendor-assets';

-- Count pending_insurance toward booth capacity (spot is reserved)
CREATE OR REPLACE FUNCTION get_available_slots(p_event_id UUID, p_category_id UUID)
RETURNS TABLE (
  category_id     UUID,
  max_slots       INTEGER,
  approved_count  INTEGER,
  available       INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ecl.category_id,
    ecl.max_slots,
    COALESCE(approved.cnt, 0)::INTEGER AS approved_count,
    GREATEST(0, ecl.max_slots - COALESCE(approved.cnt, 0))::INTEGER AS available
  FROM event_category_limits ecl
  LEFT JOIN (
    SELECT ba.category_id, COUNT(*)::INTEGER AS cnt
    FROM booth_applications ba
    WHERE ba.event_id = p_event_id
      AND ba.status IN ('approved', 'pending_insurance', 'pending')
    GROUP BY ba.category_id
  ) approved ON approved.category_id = ecl.category_id
  WHERE ecl.event_id = p_event_id
    AND ecl.category_id = p_category_id;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_category_approval_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_slots INTEGER;
  v_approved_count INTEGER;
BEGIN
  IF NEW.status IN ('approved', 'pending_insurance')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT ecl.max_slots
    INTO v_max_slots
    FROM event_category_limits ecl
    WHERE ecl.event_id = NEW.event_id
      AND ecl.category_id = NEW.category_id;

    IF v_max_slots IS NOT NULL THEN
      SELECT COUNT(*)::INTEGER
      INTO v_approved_count
      FROM booth_applications ba
      WHERE ba.event_id = NEW.event_id
        AND ba.category_id = NEW.category_id
        AND ba.status IN ('approved', 'pending_insurance')
        AND ba.id IS DISTINCT FROM NEW.id;

      IF v_approved_count >= v_max_slots THEN
        RAISE EXCEPTION 'category_full'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Notify vendor when insurance proof is required or when fully approved after upload
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
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_event_name FROM events WHERE id = NEW.event_id;

  CASE NEW.status
    WHEN 'approved' THEN
      v_type := 'application_approved';
      v_msg  := 'Your application for "' || COALESCE(v_event_name, 'the event') || '" has been approved! Get ready to set up your booth.';
    WHEN 'pending_insurance' THEN
      v_type := 'application_approved';
      v_msg  := 'Your application for "' || COALESCE(v_event_name, 'the event') || '" was approved — upload your market insurance proof to finalize your booth.';
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
