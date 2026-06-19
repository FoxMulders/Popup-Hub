-- Vendor-submitted organizer nominations (draft until admin publishes)

ALTER TABLE organizers
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_organizers_listing_source
  ON organizers (listing_status, source);

COMMENT ON COLUMN organizers.submitted_by IS 'Vendor who nominated this organizer via /check/review (not listed).';
COMMENT ON COLUMN organizers.submitted_at IS 'When the vendor nomination was submitted.';
COMMENT ON COLUMN organizer_reviews.published IS
  'False while linked organizer is draft — publish review when organizer is approved.';
