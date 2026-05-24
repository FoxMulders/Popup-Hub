-- Event coordinators may manage legacy timer auctions tied to their events,
-- including deleting rows that cascade to auction_drops.

DO $$ BEGIN
  CREATE POLICY "auctions: event coordinator manage"
    ON auctions FOR ALL
    TO authenticated
    USING (
      event_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM events e
        WHERE e.id = auctions.event_id
          AND e.coordinator_id = auth.uid()
      )
    )
    WITH CHECK (
      event_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM events e
        WHERE e.id = auctions.event_id
          AND e.coordinator_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "drops: coordinator delete for managed auction"
    ON auction_drops FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM auctions a
        LEFT JOIN events e ON e.id = a.event_id
        WHERE a.id = auction_drops.auction_id
          AND (
            a.coordinator_id = auth.uid()
            OR e.coordinator_id = auth.uid()
          )
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
