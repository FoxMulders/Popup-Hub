-- Alcohol vendor category

INSERT INTO public.categories (name, sort_order, is_mlm) VALUES
  ('Alcohol', 32, false)
ON CONFLICT (name) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_mlm = EXCLUDED.is_mlm;
