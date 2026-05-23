-- Flag applications where a multi-category vendor applied under an open category
-- while other passport categories are full at this market.

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS has_category_overflow BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS overflow_category_names TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN booth_applications.has_category_overflow IS
  'True when vendor passport spans multiple categories and at least one was full while applying under an open category.';
COMMENT ON COLUMN booth_applications.overflow_category_names IS
  'Passport category names that were full when the vendor applied (coordinator review hint).';
