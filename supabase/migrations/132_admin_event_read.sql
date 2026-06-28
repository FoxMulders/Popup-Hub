-- Platform admins can read any market (including drafts) and related event data for ops oversight.
-- SELECT only — no cross-coordinator write access via the regular authenticated client.

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE
  );
$$;

GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;

DROP POLICY IF EXISTS "events: admin read all" ON events;
CREATE POLICY "events: admin read all" ON events
  FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "ecl: admin read" ON event_category_limits;
CREATE POLICY "ecl: admin read" ON event_category_limits
  FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "event_days: admin read" ON event_days;
CREATE POLICY "event_days: admin read" ON event_days
  FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "event_schedule: admin read" ON event_schedule_items;
CREATE POLICY "event_schedule: admin read" ON event_schedule_items
  FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "layouts: admin read" ON booth_layouts;
CREATE POLICY "layouts: admin read" ON booth_layouts
  FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "applications: admin read" ON booth_applications;
CREATE POLICY "applications: admin read" ON booth_applications
  FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "platform_tx: admin read" ON platform_transactions;
CREATE POLICY "platform_tx: admin read" ON platform_transactions
  FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "passports: admin read event applicants" ON vendor_passports;
CREATE POLICY "passports: admin read event applicants" ON vendor_passports
  FOR SELECT
  USING (
    is_platform_admin()
    AND EXISTS (
      SELECT 1
      FROM booth_applications ba
      WHERE ba.vendor_id = vendor_passports.user_id
    )
  );
