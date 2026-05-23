-- Allow anonymous shoppers to view approved vendor lineups on published markets.

CREATE POLICY "applications: public read approved on published events"
  ON booth_applications
  FOR SELECT
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM events
      WHERE events.id = booth_applications.event_id
        AND events.status IN ('published', 'active', 'completed')
    )
  );

CREATE POLICY "passports: public read for published market vendors"
  ON vendor_passports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM booth_applications ba
      JOIN events e ON e.id = ba.event_id
      WHERE ba.vendor_id = vendor_passports.user_id
        AND ba.status = 'approved'
        AND e.status IN ('published', 'active', 'completed')
    )
  );
