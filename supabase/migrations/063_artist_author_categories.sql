-- General creative vendor categories (no mandatory permit upload at apply time)

INSERT INTO public.categories (name, sort_order, is_mlm, requires_documentation) VALUES
  ('Artist', 37, false, false),
  ('Author',   38, false, false)
ON CONFLICT (name) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_mlm = EXCLUDED.is_mlm,
  requires_documentation = EXCLUDED.requires_documentation;

-- Tattoo/Piercing Artist remain regulated; plain "Artist" does not inherit their flag
UPDATE public.categories
SET requires_documentation = true
WHERE name IN ('Piercing Artist', 'Tattoo Artist', 'Food (Truck)', 'Beverage (Truck)', 'Alcohol', 'Food & Beverage');

UPDATE public.categories
SET requires_documentation = false
WHERE name IN ('Artist', 'Author');
