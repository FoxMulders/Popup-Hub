-- Allow platform-admin publish assist to bypass organizer trust-path checks
-- (Stripe/Square/offline org) while still enforcing hard fraud blocks.

CREATE OR REPLACE FUNCTION public.coordinator_hard_blocks_publish(p_coordinator_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_coordinator_id;
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  IF v_profile.coordinator_account_status IN ('suspended', 'banned') THEN
    RETURN TRUE;
  END IF;

  IF COALESCE(v_profile.coordinator_risk_score, 0) > 75 THEN
    RETURN TRUE;
  END IF;

  IF v_profile.coordinator_verification_status = 'rejected' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_coordinator_event_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('published', 'active')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.status IN ('published', 'active')
     AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('published', 'active')) THEN
    IF NOT public.coordinator_can_publish_event(NEW.coordinator_id) THEN
      IF current_setting('popuphub.skip_publish_guard', true) = 'on' THEN
        IF public.coordinator_hard_blocks_publish(NEW.coordinator_id) THEN
          RAISE EXCEPTION 'Organizer account blocked from publishing this market'
            USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'Organizer verification required before publishing this market'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_event_via_publish_assist(
  p_request_id UUID,
  p_reviewer_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request event_publish_assist_requests%ROWTYPE;
  v_event events%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_reviewer_id AND p.is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
  FROM event_publish_assist_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Publish assist request not found or not pending'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_event
  FROM events
  WHERE id = v_request.event_id
  FOR UPDATE;

  IF NOT FOUND OR v_event.status <> 'draft' THEN
    RAISE EXCEPTION 'Event not found or not draft'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_event.coordinator_id IS DISTINCT FROM v_request.coordinator_id THEN
    RAISE EXCEPTION 'Event ownership mismatch'
      USING ERRCODE = 'check_violation';
  END IF;

  IF public.coordinator_hard_blocks_publish(v_event.coordinator_id) THEN
    RAISE EXCEPTION 'Organizer account blocked from publishing this market'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('popuphub.skip_publish_guard', 'on', true);

  UPDATE events
  SET status = 'published',
      updated_at = NOW()
  WHERE id = v_event.id;

  UPDATE event_publish_assist_requests
  SET status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_event_via_publish_assist(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_event_via_publish_assist(UUID, UUID) TO service_role;
