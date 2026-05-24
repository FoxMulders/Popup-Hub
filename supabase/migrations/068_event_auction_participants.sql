-- Patrons must opt in at the event (with location check) before auction actions.

CREATE TABLE IF NOT EXISTS event_auction_participants (
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_in_lat      DOUBLE PRECISION NOT NULL,
  check_in_lng      DOUBLE PRECISION NOT NULL,
  distance_meters   DOUBLE PRECISION,
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_eap_event ON event_auction_participants(event_id, participated_at DESC);

ALTER TABLE event_auction_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eap: user read own"
  ON event_auction_participants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "eap: user insert own"
  ON event_auction_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "eap: coordinator read event"
  ON event_auction_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_auction_participants.event_id
        AND e.coordinator_id = auth.uid()
    )
  );

COMMENT ON TABLE event_auction_participants IS
  'Logged-in patrons who verified on-site presence and clicked participate for an event auction.';
