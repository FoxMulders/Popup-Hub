-- Restore Woodworking in the vendor category catalog (may be missing if DB was seeded via seed.sql only).

INSERT INTO public.categories (name, sort_order, is_mlm) VALUES
  ('Woodworking', 12, false)
ON CONFLICT (name) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_mlm = EXCLUDED.is_mlm;

-- Align legacy seed name with canonical catalog entry when both exist.
UPDATE vendor_passports
SET primary_category_id = (SELECT id FROM categories WHERE name = 'Woodworking' LIMIT 1)
WHERE primary_category_id IN (SELECT id FROM categories WHERE name = 'Woodworking & Furniture')
  AND EXISTS (SELECT 1 FROM categories WHERE name = 'Woodworking');

UPDATE vendor_passports
SET category_ids = array_replace(
  category_ids,
  (SELECT id FROM categories WHERE name = 'Woodworking & Furniture' LIMIT 1),
  (SELECT id FROM categories WHERE name = 'Woodworking' LIMIT 1)
)
WHERE EXISTS (SELECT 1 FROM categories WHERE name = 'Woodworking & Furniture')
  AND EXISTS (SELECT 1 FROM categories WHERE name = 'Woodworking');
