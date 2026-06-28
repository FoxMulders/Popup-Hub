-- Allow platform admin publish-assist approval to bypass coordinator verification gate.
-- Bypass is only honored inside the SECURITY DEFINER RPC with a pending assist request.

CREATE OR REPLACE FUNCTION public.guard_coordinator_event_publish()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_assist_request_id UUID;
BEGIN
  IF NEW.status IN ('published', 'active')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('published', 'active')) THEN

    v_assist_request_id := NULLIF(current_setting('app.admin_publish_assist_request_id', true), '')::UUID;

    IF v_assist_request_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM event_publish_assist_requests r
        WHERE r.id = v_assist_request_id
          AND r.event_id = NEW.id
          AND r.coordinator_id = NEW.coordinator_id
          AND r.status = 'pending'
      ) THEN
        RETURN NEW;
      END IF;
    END IF;

    IF NOT public.coordinator_can_publish_event(NEW.coordinator_id) THEN
      RAISE EXCEPTION 'Organizer verification required before publishing this market'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_publish_assisted_event(
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
BEGIN
  IF p_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Reviewer required' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_reviewer_id AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT *
  INTO v_request
  FROM event_publish_assist_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Publish assist request not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Publish assist request is no longer pending' USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM events e
    WHERE e.id = v_request.event_id
      AND e.coordinator_id = v_request.coordinator_id
      AND e.status = 'draft'
  ) THEN
    RAISE EXCEPTION 'Only draft markets can be published via assist' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM set_config('app.admin_publish_assist_request_id', p_request_id::text, true);

  UPDATE events
  SET status = 'published',
      updated_at = NOW()
  WHERE id = v_request.event_id;

  PERFORM set_config('app.admin_publish_assist_request_id', '', true);

  UPDATE event_publish_assist_requests
  SET status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_publish_assisted_event(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_publish_assisted_event(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.admin_publish_assisted_event(UUID, UUID) IS
  'Atomically publishes a draft market and approves its pending publish-assist request (admin only).';
