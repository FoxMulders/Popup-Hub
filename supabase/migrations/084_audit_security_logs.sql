-- Immutable audit trail for manual coordinator payment clearance and approval overrides.
-- Append-only: UPDATE/DELETE blocked by trigger; inserts via SECURITY DEFINER RPC or service role.

CREATE TABLE IF NOT EXISTS audit_security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  target_vendor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  application_id UUID REFERENCES booth_applications(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (
    action_type IN (
      'MANUAL_PAYMENT_CLEARANCE',
      'STATE_OVERRIDE_APPROVAL',
      'APPLICATION_STATUS_CHANGE',
      'VENDOR_DISPUTE_SUSPENSION',
      'VENDOR_BOOTH_EVICTION',
      'PASSPORT_QR_BLOCKED'
    )
  ),
  previous_state JSONB NOT NULL,
  new_state JSONB NOT NULL,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_security_logs_created_at
  ON audit_security_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_security_logs_application
  ON audit_security_logs (application_id, created_at DESC)
  WHERE application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_security_logs_actor
  ON audit_security_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_security_logs_action_type
  ON audit_security_logs (action_type, created_at DESC);

COMMENT ON TABLE audit_security_logs IS
  'Append-only security audit for manual coordinator payment clearance and approval overrides. '
  'Readable only via service role / database admin — no client SELECT policies.';

-- ── Append-only enforcement ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_security_logs_deny_mutations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_security_logs is append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_security_logs_no_update ON audit_security_logs;
CREATE TRIGGER trg_audit_security_logs_no_update
  BEFORE UPDATE OR DELETE ON audit_security_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit_security_logs_deny_mutations();

-- ── RLS: deny all authenticated access; service role bypasses ───────────────

ALTER TABLE audit_security_logs ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for authenticated users.
-- Coordinators cannot read or mutate audit rows from the client.

-- ── Atomic booth application mutation + audit insert ────────────────────────

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
    'APPLICATION_STATUS_CHANGE'
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
  )
  VALUES (
    p_actor_id,
    p_target_vendor_id,
    p_application_id,
    p_action_type,
    p_previous_state,
    p_new_state,
    NULLIF(BTRIM(COALESCE(p_ip_address, '')), '')
  );

  RETURN jsonb_build_object(
    'application', to_jsonb(v_row)
  );
END;
$$;

REVOKE ALL ON FUNCTION mutate_booth_application_with_security_audit(
  UUID, UUID, UUID, TEXT, JSONB, JSONB, JSONB, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION mutate_booth_application_with_security_audit(
  UUID, UUID, UUID, TEXT, JSONB, JSONB, JSONB, TEXT
) TO service_role;

-- Verification example (run as service role / SQL editor):
-- SELECT id, created_at, actor_id, application_id, action_type, previous_state, new_state, ip_address
-- FROM audit_security_logs
-- WHERE application_id = '<application-uuid>'
-- ORDER BY created_at DESC;
