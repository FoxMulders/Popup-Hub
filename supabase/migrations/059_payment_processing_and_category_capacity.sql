-- Payment processing timestamp for stale-claim recovery
ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS payment_processing_at TIMESTAMPTZ;

COMMENT ON COLUMN booth_applications.payment_processing_at IS
  'Set when payment_status becomes processing; cleared when payment completes or is reset.';

-- Prevent approving more vendors than a category max_slots allows
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
  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
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
        AND ba.status = 'approved'
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

DROP TRIGGER IF EXISTS trg_enforce_category_approval_capacity ON booth_applications;
CREATE TRIGGER trg_enforce_category_approval_capacity
  BEFORE INSERT OR UPDATE OF status ON booth_applications
  FOR EACH ROW
  EXECUTE FUNCTION enforce_category_approval_capacity();
