-- Vendors may notify the event coordinator about a pending application follow-up.

DO $$ BEGIN
  CREATE POLICY "notifications: vendor application follow-up insert"
    ON notifications FOR INSERT
    TO authenticated
    WITH CHECK (
      type = 'application_follow_up'::notification_type
      AND (metadata->>'vendor_id')::uuid = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM booth_applications ba
        INNER JOIN events e ON e.id = ba.event_id
        WHERE ba.id = ((metadata->>'application_id')::uuid)
          AND ba.vendor_id = auth.uid()
          AND e.coordinator_id = notifications.user_id
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
