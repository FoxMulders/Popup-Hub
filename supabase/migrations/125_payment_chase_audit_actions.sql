-- Payment chase audit actions for auto-release and manual deadline extension.

ALTER TABLE audit_security_logs
  DROP CONSTRAINT IF EXISTS audit_security_logs_action_type_check;

ALTER TABLE audit_security_logs
  ADD CONSTRAINT audit_security_logs_action_type_check CHECK (
    action_type IN (
      'MANUAL_PAYMENT_CLEARANCE',
      'STATE_OVERRIDE_APPROVAL',
      'APPLICATION_STATUS_CHANGE',
      'VENDOR_DISPUTE_SUSPENSION',
      'VENDOR_BOOTH_EVICTION',
      'PASSPORT_QR_BLOCKED',
      'PAYMENT_DEADLINE_EXPIRY',
      'PAYMENT_DEADLINE_EXTENDED'
    )
  );

CREATE OR REPLACE FUNCTION mutate_booth_application_with_security_audit(
  p_application_id UUID,
  p_actor_id UUID,
  p_target_vendor_id UUID,
  p_action_type TEXT,
  p_previous_state JSONB,
  p_new_state JSONB,
  p_updates JSONB,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coordinator_id UUID;
  v_row booth_applications%ROWTYPE;
BEGIN
  IF p_action_type NOT IN (
    'MANUAL_PAYMENT_CLEARANCE',
    'STATE_OVERRIDE_APPROVAL',
    'APPLICATION_STATUS_CHANGE',
    'VENDOR_DISPUTE_SUSPENSION',
    'VENDOR_BOOTH_EVICTION',
    'PASSPORT_QR_BLOCKED',
    'PAYMENT_DEADLINE_EXPIRY',
    'PAYMENT_DEADLINE_EXTENDED'
  ) THEN
    RAISE EXCEPTION 'Invalid action_type: %', p_action_type USING ERRCODE = '22023';
  END IF;

  SELECT e.coordinator_id
  INTO v_coordinator_id
  FROM booth_applications ba
  JOIN events e ON e.id = ba.event_id
  WHERE ba.id = p_application_id
  FOR UPDATE OF ba;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_coordinator_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE booth_applications
  SET
    status = COALESCE((p_updates->>'status')::application_status, status),
    application_payment_status = CASE
      WHEN p_updates ? 'application_payment_status' THEN
        CASE
          WHEN p_updates->>'application_payment_status' IS NULL THEN NULL
          ELSE (p_updates->>'application_payment_status')::application_payment_status
        END
      ELSE application_payment_status
    END,
    payment_status = COALESCE((p_updates->>'payment_status')::payment_status, payment_status),
    payment_method = CASE
      WHEN p_updates ? 'payment_method' THEN
        CASE
          WHEN p_updates->>'payment_method' IS NULL THEN NULL
          ELSE (p_updates->>'payment_method')::application_payment_method
        END
      ELSE payment_method
    END,
    approved_at = CASE
      WHEN p_updates ? 'approved_at' THEN
        CASE
          WHEN p_updates->>'approved_at' IS NULL THEN NULL
          ELSE (p_updates->>'approved_at')::timestamptz
        END
      ELSE approved_at
    END,
    coordinator_decline_message = CASE
      WHEN p_updates ? 'coordinator_decline_message' THEN p_updates->>'coordinator_decline_message'
      ELSE coordinator_decline_message
    END,
    payment_due_at = CASE
      WHEN p_updates ? 'payment_due_at' THEN
        CASE
          WHEN p_updates->>'payment_due_at' IS NULL THEN NULL
          ELSE (p_updates->>'payment_due_at')::timestamptz
        END
      ELSE payment_due_at
    END,
    payment_reminder_stage = CASE
      WHEN p_updates ? 'payment_reminder_stage' THEN (p_updates->>'payment_reminder_stage')::smallint
      ELSE payment_reminder_stage
    END,
    last_payment_reminder_at = CASE
      WHEN p_updates ? 'last_payment_reminder_at' THEN
        CASE
          WHEN p_updates->>'last_payment_reminder_at' IS NULL THEN NULL
          ELSE (p_updates->>'last_payment_reminder_at')::timestamptz
        END
      ELSE last_payment_reminder_at
    END
  WHERE id = p_application_id
  RETURNING * INTO v_row;

  INSERT INTO audit_security_logs (
    actor_id,
    target_vendor_id,
    application_id,
    action_type,
    previous_state,
    new_state,
    ip_address
  ) VALUES (
    p_actor_id,
    p_target_vendor_id,
    p_application_id,
    p_action_type,
    p_previous_state,
    p_new_state,
    p_ip_address
  );

  RETURN jsonb_build_object('application', to_jsonb(v_row));
END;
$$;
