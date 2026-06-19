-- Trust-first coordinator conversion: mention threads, responses, PH event sync

ALTER TABLE organizer_community_mentions
  ADD COLUMN IF NOT EXISTS responds_to_mention_id UUID
    REFERENCES organizer_community_mentions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_organizer_mentions_responds_to
  ON organizer_community_mentions (responds_to_mention_id);

ALTER TABLE organizer_events
  ADD COLUMN IF NOT EXISTS popup_hub_event_id UUID REFERENCES events(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS organizer_review_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id       UUID NOT NULL UNIQUE REFERENCES organizer_reviews(id) ON DELETE CASCADE,
  responder_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response_body   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizer_mention_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mention_id      UUID NOT NULL UNIQUE REFERENCES organizer_community_mentions(id) ON DELETE CASCADE,
  responder_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response_body   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE organizer_review_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_mention_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizer_review_responses: public read" ON organizer_review_responses
  FOR SELECT USING (true);

CREATE POLICY "organizer_mention_responses: public read" ON organizer_mention_responses
  FOR SELECT USING (true);

CREATE POLICY "organizer_review_responses: coordinator insert own claim" ON organizer_review_responses
  FOR INSERT
  WITH CHECK (
    auth.uid() = responder_id
    AND EXISTS (
      SELECT 1
      FROM organizer_reviews r
      JOIN organizers o ON o.id = r.organizer_id
      WHERE r.id = review_id
        AND (o.claimed_by = auth.uid() OR o.popup_hub_coordinator_id = auth.uid())
    )
  );

CREATE POLICY "organizer_mention_responses: coordinator insert own claim" ON organizer_mention_responses
  FOR INSERT
  WITH CHECK (
    auth.uid() = responder_id
    AND EXISTS (
      SELECT 1
      FROM organizer_community_mentions m
      JOIN organizers o ON o.id = m.organizer_id
      WHERE m.id = mention_id
        AND (o.claimed_by = auth.uid() OR o.popup_hub_coordinator_id = auth.uid())
    )
  );

CREATE POLICY "organizer_review_responses: coordinator update own" ON organizer_review_responses
  FOR UPDATE USING (auth.uid() = responder_id);

-- Admin moderation for reviews (service role bypasses RLS)
CREATE POLICY "organizer_reviews: admin update" ON organizer_reviews
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = TRUE)
  );

COMMENT ON COLUMN organizer_community_mentions.responds_to_mention_id IS 'Links organizer clarification to vendor concern in same thread.';
COMMENT ON COLUMN organizer_events.popup_hub_event_id IS 'PopUp Hub event when coordinator syncs trust directory from published market.';
