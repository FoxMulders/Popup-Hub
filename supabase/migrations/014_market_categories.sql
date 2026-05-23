-- Additional market vendor categories

ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_mlm BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.categories (name, sort_order, is_mlm) VALUES
  ('3D Printing',              16, false),
  ('Epoxy Resin',              17, false),
  ('Chimes & Wind Art',        18, false),
  ('Baking & Pastries',        19, false),
  ('Leather & Leathercraft',   20, false),
  ('Glass & Stained Glass',    21, false),
  ('Metalwork & Blacksmithing',22, false),
  ('Fiber Arts & Yarn',        23, false),
  ('Printmaking & Stationery', 24, false),
  ('Photography & Prints',     25, false),
  ('Electronics & Gadgets',    26, false),
  ('Upcycled & Repurposed',    27, false),
  ('Herbal & Apothecary',      28, false),
  ('Honey & Preserves',        29, false),
  ('Macrame & Weaving',        30, false)
ON CONFLICT (name) DO NOTHING;

-- Ensure Woodworking stays in catalog (seeded in 002; no-op if present)
INSERT INTO public.categories (name, sort_order, is_mlm) VALUES
  ('Woodworking', 12, false)
ON CONFLICT (name) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_mlm = EXCLUDED.is_mlm;
