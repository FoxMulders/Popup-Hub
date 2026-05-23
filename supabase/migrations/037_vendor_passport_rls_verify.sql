-- Ensure vendors can always read their own passport (verified or not),
-- coordinators can verify passports for vendors on their events,
-- and vendors cannot self-verify.

DROP POLICY IF EXISTS "passports: owner full access" ON vendor_passports;

CREATE POLICY "passports: users can read own passport" ON vendor_passports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "passports: owner insert" ON vendor_passports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "passports: owner update" ON vendor_passports
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "passports: owner delete" ON vendor_passports
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "passports: coordinator verify event vendors" ON vendor_passports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'coordinator'
    )
    AND EXISTS (
      SELECT 1 FROM booth_applications ba
      INNER JOIN events e ON e.id = ba.event_id
      WHERE ba.vendor_id = vendor_passports.user_id
        AND e.coordinator_id = auth.uid()
    )
  )
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION vendor_passports_verify_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    IF NEW.is_verified = TRUE AND NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator'
    ) THEN
      RAISE EXCEPTION 'Only coordinators can verify vendor passports';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_passports_verify_guard ON vendor_passports;

CREATE TRIGGER vendor_passports_verify_guard
  BEFORE UPDATE ON vendor_passports
  FOR EACH ROW
  EXECUTE FUNCTION vendor_passports_verify_guard();
