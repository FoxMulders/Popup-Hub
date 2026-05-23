-- Booth depth for table-provided spacing: (4' + table_length + 3') × 4' wide

COMMENT ON COLUMN event_category_limits.table_length_ft IS
  'Default table length L (ft); booth footprint is (4'' + L + 3'') × 4'' when market provides tables.';
COMMENT ON COLUMN booth_applications.table_length_ft IS
  'Table length L (ft) for this vendor; booth footprint is (4'' + L + 3'') × 4''.';
COMMENT ON COLUMN booth_layouts.spacing_mode IS
  'standard = fixed booth grid; table_provided = (4ft + table length + 3ft) deep × 4ft wide per booth.';
