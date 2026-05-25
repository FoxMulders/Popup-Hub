-- Coordinators can read vendor passports for vendors who applied to their events
-- (supports nested booth_applications → profiles → vendor_passports selects).

DROP POLICY IF EXISTS "passports: coordinator read event applicants" ON vendor_passports;

CREATE POLICY "passports: coordinator read event applicants" ON vendor_passports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM booth_applications ba
      INNER JOIN events e ON e.id = ba.event_id
      WHERE ba.vendor_id = vendor_passports.user_id
        AND e.coordinator_id = auth.uid()
    )
  );
