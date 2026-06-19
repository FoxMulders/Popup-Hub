-- Structured vendor reviews of market organizers (trust directory)

CREATE TABLE IF NOT EXISTS organizer_reviews (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id              UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  vendor_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_name                TEXT NOT NULL,
  event_month_year          TEXT NOT NULL,
  event_as_advertised       TEXT NOT NULL
    CHECK (event_as_advertised IN ('yes', 'partial', 'no')),
  would_return              BOOLEAN NOT NULL,
  attendance_vs_expectations TEXT NOT NULL
    CHECK (attendance_vs_expectations IN ('much_lower', 'lower', 'about_right', 'higher')),
  communication_rating      INT NOT NULL
    CHECK (communication_rating BETWEEN 1 AND 5),
  refund_experience         TEXT NOT NULL DEFAULT 'na'
    CHECK (refund_experience IN ('na', 'fast', 'slow', 'never_received')),
  optional_notes            TEXT,
  verification_tier         TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_tier IN ('unverified', 'receipt_verified', 'invited_verified', 'platform_verified')),
  published                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organizer_id, vendor_id, event_name, event_month_year)
);

CREATE INDEX IF NOT EXISTS idx_organizer_reviews_organizer ON organizer_reviews (organizer_id);
CREATE INDEX IF NOT EXISTS idx_organizer_reviews_vendor ON organizer_reviews (vendor_id);

ALTER TABLE organizer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizer_reviews: public read published" ON organizer_reviews
  FOR SELECT USING (published = TRUE);

CREATE POLICY "organizer_reviews: vendor insert own" ON organizer_reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() = vendor_id
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('vendor', 'coordinator')
    )
  );

CREATE POLICY "organizer_reviews: vendor read own" ON organizer_reviews
  FOR SELECT USING (auth.uid() = vendor_id);

COMMENT ON TABLE organizer_reviews IS 'Vendor-submitted retroactive reviews of organizers; one row per vendor per event month.';
