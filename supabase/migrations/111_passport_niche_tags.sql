-- Passport niche tags: food/craft discovery tags + MLM brand tags (niche only).
-- MLM brand rows are hidden in the passport wizard unless primary is
-- Multi Level Marketer (MLM); see filterPassportNicheCategories.

INSERT INTO public.categories (name, sort_order, is_mlm, is_broad, requires_documentation) VALUES
  ('Hot Sauce',                 40, false, false, false),
  ('BBQ Sauces',                41, false, false, false),
  ('Salsa',                     42, false, false, false),
  ('Beef Jerky',                43, false, false, false),
  ('Smoked Meats',              44, false, false, false),
  ('Pickles & Ferments',        45, false, false, false),
  ('Spice Blends',              46, false, false, false),
  ('Coffee & Tea',              47, false, false, false),
  ('Knitting',                  48, false, false, false),
  ('Crochet',                   49, false, false, false),
  ('Embroidery',                50, false, false, false),
  ('Birdhouses',                51, false, false, false),
  ('Wood Signs & Decor',        52, false, false, false),
  ('4Life',                     53, true, false, false),
  ('Amway',                     54, true, false, false),
  ('Arbonne',                   55, true, false, false),
  ('Avon',                      56, true, false, false),
  ('Color Street',              57, true, false, false),
  ('doTERRA',                   58, true, false, false),
  ('Norwex',                    59, true, false, false),
  ('Scentsy',                   60, true, false, false),
  ('The Super Patch Company',   61, true, false, false)
ON CONFLICT (name) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_mlm = EXCLUDED.is_mlm,
  is_broad = EXCLUDED.is_broad,
  requires_documentation = EXCLUDED.requires_documentation;
