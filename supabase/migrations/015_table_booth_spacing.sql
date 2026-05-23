-- Table-provided booth spacing: 4' wide, depth = table_length + 3'

ALTER TABLE event_category_limits
  ADD COLUMN IF NOT EXISTS table_length_ft INTEGER
    CHECK (table_length_ft IS NULL OR (table_length_ft >= 4 AND table_length_ft <= 20));

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS table_length_ft INTEGER
    CHECK (table_length_ft IS NULL OR (table_length_ft >= 4 AND table_length_ft <= 20));

ALTER TABLE booth_layouts
  ADD COLUMN IF NOT EXISTS spacing_mode TEXT NOT NULL DEFAULT 'standard'
    CHECK (spacing_mode IN ('standard', 'table_provided'));

COMMENT ON COLUMN event_category_limits.table_length_ft IS
  'Default table length (ft) vendors use when market provides tables; booth depth = length + 3, width = 4.';
COMMENT ON COLUMN booth_applications.table_length_ft IS
  'Table length (ft) for this vendor; booth footprint is (length+3) x 4 feet.';
COMMENT ON COLUMN booth_layouts.spacing_mode IS
  'standard = fixed booth grid size; table_provided = 4ft wide, depth per table length + 3ft.';
