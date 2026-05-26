-- ============================================================
-- 083_category_broad_flag.sql
-- Mark a curated set of categories as "broad" (primary-eligible).
-- Vendors must pick a broad category as their passport primary;
-- niche categories may only be picked as secondaries. Coordinator
-- category-limit slots default to broad categories; niche caps are
-- still allowed but treated as advanced sub-caps.
-- ============================================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_broad BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_categories_is_broad ON public.categories (is_broad);

-- ── Curated broad set ───────────────────────────────────────
-- These are the only categories vendors may pick as their primary
-- and the only categories shown by default in the coordinator's
-- category-limit picker. All other categories remain selectable as
-- vendor secondaries / discovery filters / advanced niche caps.

UPDATE public.categories
SET is_broad = true
WHERE name IN (
  'Artisan Crafts',
  'Candles & Soaps',
  'Clothing & Apparel',
  'Food & Beverage',
  'Fresh Produce',
  'Home Decor',
  'Jewelry',
  'Pet Products',
  'Plants & Flowers',
  'Pottery & Ceramics',
  'Vintage & Antiques',
  'Woodworking',
  'Health & Wellness',
  'Books & Art',
  'Kids & Toys',
  'Electronics & Gadgets',
  'Alcohol'
);

-- ── Niche → broad mapping table (used for migrating existing data) ──
-- Held in a CTE so this migration is idempotent and self-contained.

WITH niche_to_broad(niche_name, broad_name) AS (
  VALUES
    ('3D Printing',                'Artisan Crafts'),
    ('Epoxy Resin',                'Artisan Crafts'),
    ('Leather & Leathercraft',     'Artisan Crafts'),
    ('Glass & Stained Glass',      'Artisan Crafts'),
    ('Metalwork & Blacksmithing',  'Artisan Crafts'),
    ('Fiber Arts & Yarn',          'Artisan Crafts'),
    ('Macrame & Weaving',          'Artisan Crafts'),
    ('Laser Cutting & Engraving',  'Artisan Crafts'),

    ('Chimes & Wind Art',          'Home Decor'),
    ('Upcycled & Repurposed',      'Vintage & Antiques'),

    ('Baking & Pastries',          'Food & Beverage'),
    ('Honey & Preserves',          'Food & Beverage'),
    ('Food (Truck)',               'Food & Beverage'),
    ('Beverage (Truck)',           'Food & Beverage'),

    ('Herbal & Apothecary',        'Health & Wellness'),
    ('Piercing Artist',            'Health & Wellness'),
    ('Tattoo Artist',              'Health & Wellness'),

    ('Printmaking & Stationery',   'Books & Art'),
    ('Photography & Prints',       'Books & Art'),
    ('Artist',                     'Books & Art'),
    ('Author',                     'Books & Art')
)
UPDATE public.vendor_passports vp
SET primary_category_id = broad.id
FROM niche_to_broad nm
JOIN public.categories niche ON niche.name = nm.niche_name
JOIN public.categories broad ON broad.name = nm.broad_name AND broad.is_broad = true
WHERE vp.primary_category_id = niche.id;

-- ── Defensive fallback for vendors whose primary is a niche we did not map ──
-- Pick the first broad category from their secondaries (category_ids), if any.

UPDATE public.vendor_passports vp
SET primary_category_id = picked.id
FROM (
  SELECT vp2.id AS passport_id, c.id, c.name
  FROM public.vendor_passports vp2
  JOIN public.categories pc ON pc.id = vp2.primary_category_id
  JOIN LATERAL (
    SELECT c.id, c.name
    FROM public.categories c
    WHERE c.is_broad = true
      AND c.id = ANY(vp2.category_ids)
    ORDER BY c.name
    LIMIT 1
  ) c ON true
  WHERE pc.is_broad = false
) picked
WHERE vp.id = picked.passport_id;

-- Note: any remaining vendor_passports whose primary is still a niche
-- (no mapping + no broad secondary) will be flagged in-app and the vendor
-- will be prompted to re-pick a broad primary on next save. We do not null
-- the column here because primary_category_id is NOT NULL.
