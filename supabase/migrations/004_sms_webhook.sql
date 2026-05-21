-- ── Migration 004: Register DB webhook for SMS notifications ─────────────────
-- Calls the send-sms-notification Edge Function whenever a new notification
-- row is inserted. Requires the pg_net extension (enabled by default on
-- Supabase hosted projects).
--
-- Replace <PROJECT_REF> with your actual Supabase project reference before
-- running, or configure via Supabase Dashboard → Database → Webhooks.

-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the webhook trigger function
CREATE OR REPLACE FUNCTION call_sms_notification_edge_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_url TEXT := current_setting('app.settings.supabase_url', true);
  v_service_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  -- Only attempt if edge function URL and key are configured
  IF v_project_url IS NULL OR v_project_url = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_project_url || '/functions/v1/send-sms-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_key, '')
    ),
    body    := jsonb_build_object(
      'type',   'INSERT',
      'table',  'notifications',
      'record', row_to_json(NEW)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_notification ON notifications;
CREATE TRIGGER trg_sms_notification
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION call_sms_notification_edge_fn();

-- Set the project URL and service role key as DB settings
-- (Run these manually with your actual values after deployment):
--
--   ALTER DATABASE postgres SET "app.settings.supabase_url" = 'https://<ref>.supabase.co';
--   ALTER DATABASE postgres SET "app.settings.service_role_key" = '<your-service-role-key>';
