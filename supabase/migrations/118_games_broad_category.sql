-- Games broad category for booth capacity / passport primary selection.
-- Woodworking is re-affirmed as broad for coordinators who seeded before 083.

INSERT INTO public.categories (name, sort_order, is_mlm, is_broad, requires_documentation) VALUES
  ('Games', 62, false, true, false)
ON CONFLICT (name) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_mlm = EXCLUDED.is_mlm,
  is_broad = EXCLUDED.is_broad,
  requires_documentation = EXCLUDED.requires_documentation;

UPDATE public.categories
SET is_broad = true
WHERE name = 'Woodworking';
