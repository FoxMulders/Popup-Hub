-- Broad vendor categories for booth capacity / passport primary selection.
-- Coordinator-requested craft & maker buckets (2026-06).

INSERT INTO public.categories (name, sort_order, is_mlm, is_broad, requires_documentation) VALUES
  ('Candles & Wax Melts',           63, false, true, false),
  ('Ceramics & Pottery',            64, false, true, false),
  ('Woodworking & Furniture',         65, false, true, false),
  ('Pet Accessories & Treats',        66, false, true, false),
  ('Toys & Children''s Items',        67, false, true, false),
  ('Paper Goods & Stickers',          68, false, true, false),
  ('Upcycled & Reclaimed Goods',      69, false, true, false),
  ('Jewelry & Accessories',           70, false, true, false),
  ('Glass & Stained Glass',           71, false, true, false),
  ('Textiles & Quilting',             72, false, true, false),
  ('Leather Goods',                   73, false, true, false),
  ('Soaps & Body Care',                74, false, true, false),
  ('Seasonal & Holiday Decor',        75, false, true, false),
  ('Metalwork & Blacksmithing',       76, false, true, false),
  ('Knitted & Woven Goods',           77, false, true, false),
  ('Plant & Floral Crafts',           78, false, true, false)
ON CONFLICT (name) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_mlm = EXCLUDED.is_mlm,
  is_broad = EXCLUDED.is_broad,
  requires_documentation = EXCLUDED.requires_documentation;
