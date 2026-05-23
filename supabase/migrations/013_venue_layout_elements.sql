-- Custom venue fixtures: doors, aisles, restrooms, etc. (grid coordinates)
ALTER TABLE booth_layouts
  ADD COLUMN IF NOT EXISTS venue_elements JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN booth_layouts.venue_elements IS
  'Non-booth grid markers: doors, aisles, exits, restrooms, stage, labels, etc.';
