-- Allow vendors to select multiple business categories on their passport

ALTER TABLE vendor_passports
  ADD COLUMN IF NOT EXISTS category_ids UUID[] NOT NULL DEFAULT '{}';

UPDATE vendor_passports
SET category_ids = ARRAY[primary_category_id]::UUID[]
WHERE primary_category_id IS NOT NULL
  AND (category_ids IS NULL OR category_ids = '{}');

CREATE INDEX IF NOT EXISTS idx_vendor_passports_category_ids
  ON vendor_passports USING GIN (category_ids);
